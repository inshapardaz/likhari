import type { SerializedEditorState } from 'lexical';
import type { ConverterContext } from '../types';
import {
  FORMAT_BOLD, FORMAT_CODE, FORMAT_HIGHLIGHT, FORMAT_ITALIC, FORMAT_STRIKETHROUGH,
  FORMAT_SUBSCRIPT, FORMAT_SUPERSCRIPT, FORMAT_UNDERLINE, INDENT_PX, collectFootnoteOrder, rootChildren, type SNode,
} from '../shared/serialized';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Wrapping order matters for round-trips: outermost first. */
const FORMAT_TAGS: Array<[number, string]> = [
  [FORMAT_CODE, 'code'],
  [FORMAT_BOLD, 'strong'],
  [FORMAT_ITALIC, 'em'],
  [FORMAT_UNDERLINE, 'u'],
  [FORMAT_STRIKETHROUGH, 's'],
  [FORMAT_SUBSCRIPT, 'sub'],
  [FORMAT_SUPERSCRIPT, 'sup'],
  [FORMAT_HIGHLIGHT, 'mark'],
];

const ALIGNMENTS = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

function textToHtml(node: SNode): string {
  const text = String(node.text ?? '');
  let out = escapeHtml(text).replace(/\t/g, '&#9;');
  const format = Number(node.format ?? 0);
  const style = String(node.style ?? '').trim();
  if (style) out = `<span style="${escapeAttr(style)}">${out}</span>`;
  for (const [bit, tag] of FORMAT_TAGS) {
    if (format & bit) out = `<${tag}>${out}</${tag}>`;
  }
  return out;
}

function inlineChildren(node: SNode, ctx?: ConverterContext): string {
  return (node.children ?? []).map((child) => nodeToHtml(child, ctx)).join('');
}

/** `dir`, `style` (alignment, indent) and any extra attributes for a block. */
function blockAttrs(node: SNode, extra = ''): string {
  let attrs = '';
  if (node.direction === 'rtl' || node.direction === 'ltr') attrs += ` dir="${node.direction}"`;
  const styles: string[] = [];
  const format = String(node.format ?? '');
  if (ALIGNMENTS.has(format)) styles.push(`text-align: ${format}`);
  const indent = Number(node.indent ?? 0);
  if (indent > 0) styles.push(`padding-inline-start: ${indent * INDENT_PX}px`);
  if (styles.length > 0) attrs += ` style="${styles.join('; ')}"`;
  return attrs + extra;
}

function listToHtml(node: SNode, ctx?: ConverterContext): string {
  const listType = String(node.listType ?? 'bullet');
  const tag = listType === 'number' ? 'ol' : 'ul';
  let extra = '';
  if (tag === 'ol' && Number(node.start) > 1) extra += ` start="${Number(node.start)}"`;
  if (listType === 'check') extra += ' data-list-type="check"';
  const items = (node.children ?? []).map((item) => listItemToHtml(item, listType, ctx)).join('');
  return `<${tag}${blockAttrs(node, extra)}>${items}</${tag}>`;
}

function listItemToHtml(item: SNode, listType: string, ctx?: ConverterContext): string {
  const children = item.children ?? [];
  // Lexical nests a sublist as a listitem whose only child is the list.
  if (children.length === 1 && children[0].type === 'list') {
    return `<li style="list-style-type: none">${listToHtml(children[0], ctx)}</li>`;
  }
  const checked = listType === 'check' ? ` data-checked="${item.checked ? 'true' : 'false'}"` : '';
  return `<li${blockAttrs(item, checked)}>${inlineChildren(item, ctx)}</li>`;
}

function tableToHtml(node: SNode, ctx?: ConverterContext): string {
  const rows = (node.children ?? [])
    .map((row) => {
      const cells = (row.children ?? [])
        .map((cell) => {
          const header = Number(cell.headerState ?? 0) !== 0;
          const tag = header ? 'th' : 'td';
          const span =
            (Number(cell.colSpan) > 1 ? ` colspan="${Number(cell.colSpan)}"` : '') +
            (Number(cell.rowSpan) > 1 ? ` rowspan="${Number(cell.rowSpan)}"` : '');
          const content = (cell.children ?? []).map((child) => nodeToHtml(child, ctx)).join('');
          return `<${tag}${span}>${content}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

/** Set once per serializeHtml() call and read by the footnote cases below —
 * avoids threading a numbering map through every recursive nodeToHtml call
 * for what is otherwise a leaf concern of two node types. Safe because
 * serialization is synchronous and this module is never re-entered mid-call. */
let footnoteOrder: Map<string, number> = new Map();

function footnoteReferenceToHtml(node: SNode): string {
  const id = String(node.footnoteId ?? '');
  const n = footnoteOrder.get(id) ?? '?';
  return `<sup data-likhari-footnote-ref="${escapeAttr(id)}"><a href="#fn-${escapeAttr(id)}" id="fnref-${escapeAttr(id)}">${n}</a></sup>`;
}

function footnoteListToHtml(node: SNode, ctx?: ConverterContext): string {
  const items = (node.children ?? [])
    .map((item) => {
      const id = String(item.footnoteId ?? '');
      const body = (item.children ?? []).map((child) => nodeToHtml(child, ctx)).join('');
      return `<li id="fn-${escapeAttr(id)}" data-likhari-footnote-item="${escapeAttr(id)}">${body} <a href="#fnref-${escapeAttr(id)}">↩</a></li>`;
    })
    .join('');
  return `<ol data-likhari-footnote-list>${items}</ol>`;
}

function layoutToHtml(node: SNode, ctx?: ConverterContext): string {
  const items = node.children ?? [];
  const templateColumns = typeof node.templateColumns === 'string' ? node.templateColumns : `repeat(${items.length}, 1fr)`;
  const columns = items
    .map((item) => `<div data-likhari-layout-item>${(item.children ?? []).map((child) => nodeToHtml(child, ctx)).join('')}</div>`)
    .join('');
  return `<div data-likhari-layout-container style="display: grid; grid-template-columns: ${escapeAttr(templateColumns)}">${columns}</div>`;
}

function poetryToHtml(node: SNode, ctx?: ConverterContext): string {
  const layout = node.layout === 'two-column' ? 'two-column' : 'single';
  const align = typeof node.align === 'string' ? node.align : 'justify';
  const inner = (node.children ?? []).map((child) => nodeToHtml(child, ctx)).join('');
  return `<div data-likhari-poetry-layout="${layout}" data-likhari-poetry-align="${align}" style="text-align: ${escapeAttr(align)}">${inner}</div>`;
}

function imageToHtml(node: SNode, ctx?: ConverterContext): string {
  const rawSrc = String(node.src ?? '');
  const src = ctx?.resolveImageUrl ? ctx.resolveImageUrl(rawSrc) : rawSrc;
  let img = `<img src="${escapeAttr(src)}" alt="${escapeAttr(String(node.altText ?? ''))}"`;
  if (node.width) img += ` width="${Number(node.width)}"`;
  if (node.height) img += ` height="${Number(node.height)}"`;
  img += ` data-link-type="${node.linkType === 'embedded' ? 'embedded' : 'linked'}">`;
  const caption = typeof node.caption === 'string' && node.caption !== '' ? `<figcaption>${escapeHtml(node.caption)}</figcaption>` : '';
  return `<figure>${img}${caption}</figure>`;
}

export function nodeToHtml(node: SNode, ctx?: ConverterContext): string {
  switch (node.type) {
    case 'text':
      return textToHtml(node);
    case 'linebreak':
      return '<br>';
    case 'tab':
      return '&#9;';
    case 'paragraph':
      return `<p${blockAttrs(node)}>${inlineChildren(node, ctx)}</p>`;
    case 'heading': {
      const tag = /^h[1-6]$/.test(String(node.tag)) ? String(node.tag) : 'h2';
      return `<${tag}${blockAttrs(node)}>${inlineChildren(node, ctx)}</${tag}>`;
    }
    case 'quote':
      return `<blockquote${blockAttrs(node)}>${inlineChildren(node, ctx)}</blockquote>`;
    case 'list':
      return listToHtml(node, ctx);
    case 'link':
    case 'autolink': {
      const attrs =
        ` href="${escapeAttr(String(node.url ?? ''))}"` +
        (node.rel ? ` rel="${escapeAttr(String(node.rel))}"` : '') +
        (node.target ? ` target="${escapeAttr(String(node.target))}"` : '') +
        (node.title ? ` title="${escapeAttr(String(node.title))}"` : '');
      return `<a${attrs}>${inlineChildren(node, ctx)}</a>`;
    }
    case 'horizontalrule':
      return '<hr>';
    case 'page-break':
      return '<div data-likhari-page-break style="page-break-after: always"></div>';
    case 'image':
      return imageToHtml(node, ctx);
    case 'table':
      return tableToHtml(node, ctx);
    case 'layout-container':
      return layoutToHtml(node, ctx);
    case 'footnote-reference':
      return footnoteReferenceToHtml(node);
    case 'footnote-list':
      return footnoteListToHtml(node, ctx);
    case 'poetry-couplet':
      return poetryToHtml(node, ctx);
    default:
      // Unknown node (e.g. a future feature): keep its content, drop the wrapper.
      return inlineChildren(node, ctx);
  }
}

export function serializeHtml(state: SerializedEditorState, ctx?: ConverterContext): string {
  const blocks = rootChildren(state);
  footnoteOrder = collectFootnoteOrder(blocks);
  return blocks.map((node) => nodeToHtml(node, ctx)).join('\n');
}
