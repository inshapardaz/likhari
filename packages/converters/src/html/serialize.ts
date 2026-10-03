import type { SerializedEditorState } from 'lexical';
import type { ConverterContext } from '../types';
import {
  POETRY_CENTERED_WIDTH, POETRY_COUPLET_GAP, POETRY_GUTTER_PX, POETRY_RULE, POETRY_STAGGER_WIDTH, layoutOrDefault, scaleOrDefault,
} from '../shared/poetry';
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

/** Table and footnote styling matching editor.css, written inline so exported HTML keeps it. */
const TABLE_BORDER = '#cfcac0';
const TABLE_HEADER_BG = '#f1efe9';
const TABLE_STYLE = 'border-collapse: collapse; margin: 1em 0; width: 100%';
const CELL_STYLE = `border: 1px solid ${TABLE_BORDER}; padding: 6px 10px; min-width: 72px; vertical-align: top`;
const HEADER_CELL_STYLE = `background: ${TABLE_HEADER_BG}; font-weight: 600; text-align: start`;
const FOOTNOTE_LIST_STYLE = `list-style: none; margin: 2em 0 0 0; padding: 0.75em 0 0 1.5em; border-top: 1px solid ${TABLE_BORDER}; font-size: 0.9em`;

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
          const style = header ? `${CELL_STYLE}; ${HEADER_CELL_STYLE}` : CELL_STYLE;
          return `<${tag}${span} style="${escapeAttr(style)}">${content}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table style="${escapeAttr(TABLE_STYLE)}"><tbody>${rows}</tbody></table>`;
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
      const number = `<span data-likhari-footnote-number style="font-weight: 600">[${footnoteOrder.get(id) ?? '?'}] </span>`;
      return `<li id="fn-${escapeAttr(id)}" data-likhari-footnote-item="${escapeAttr(id)}" style="margin: 0.3em 0">${number}${body} <a href="#fnref-${escapeAttr(id)}">↩</a></li>`;
    })
    .join('');
  return `<ol data-likhari-footnote-list style="${escapeAttr(FOOTNOTE_LIST_STYLE)}">${items}</ol>`;
}

function layoutToHtml(node: SNode, ctx?: ConverterContext): string {
  const items = node.children ?? [];
  const templateColumns = typeof node.templateColumns === 'string' ? node.templateColumns : `repeat(${items.length}, 1fr)`;
  const columns = items
    .map((item) => `<div data-likhari-layout-item>${(item.children ?? []).map((child) => nodeToHtml(child, ctx)).join('')}</div>`)
    .join('');
  return `<div data-likhari-layout-container style="display: grid; grid-template-columns: ${escapeAttr(templateColumns)}">${columns}</div>`;
}

function firstDirection(nodes: SNode[]): 'rtl' | 'ltr' {
  for (const node of nodes) {
    if (node.direction === 'rtl' || node.direction === 'ltr') return node.direction;
    const inner = firstDirection(node.children ?? []);
    if (inner) return inner;
  }
  return 'ltr';
}

/** One misra line; styles are inline so the exported page keeps the editor's look. */
function poetryLineToHtml(line: SNode, extraStyle: string, ctx?: ConverterContext): string {
  const dir = line.direction === 'rtl' || line.direction === 'ltr' ? ` dir="${line.direction}"` : '';
  const style = ['margin: 0', extraStyle].filter(Boolean).join('; ');
  return `<p${dir} style="${escapeAttr(style)}">${inlineChildren(line, ctx)}</p>`;
}

function poetryToHtml(node: SNode, ctx?: ConverterContext): string {
  const layout = layoutOrDefault(node.layout);
  const spacing = scaleOrDefault(node.spacing);
  const gutter = scaleOrDefault(node.gutter);
  const stagger = scaleOrDefault(node.stagger);
  const width = typeof node.width === 'number' && node.width > 0 ? node.width : undefined;
  const children = node.children ?? [];
  const dir = firstDirection(children);
  const gap = POETRY_COUPLET_GAP[spacing];
  const separator = `border-top: ${POETRY_RULE}; margin-top: ${gap}; padding-top: calc(${gap} * 0.6)`;

  let body: string;
  if (layout === 'two-column') {
    body = children
      .map((row, r) => {
        const items = row.children ?? [];
        const centered = items.length === 1;
        const templateColumns = typeof row.templateColumns === 'string' ? row.templateColumns : `repeat(${Math.max(items.length, 1)}, 1fr)`;
        const rowStyle = [
          'display: grid',
          'gap: 0',
          `grid-template-columns: ${templateColumns}`,
          'margin: 0',
          ...(r > 0 ? [separator] : []),
          ...(centered ? [`width: ${POETRY_CENTERED_WIDTH}`, 'margin-inline: auto'] : []),
        ].join('; ');
        const px = POETRY_GUTTER_PX[gutter];
        const cells = items
          .map((item, i) => {
            const cellStyle = centered
              ? 'padding-inline: 0'
              : i === 0
                ? `padding-inline-end: ${px}px`
                : `border-inline-start: ${POETRY_RULE}; padding-inline-start: ${px}px`;
            const lines = (item.children ?? []).map((line) => poetryLineToHtml(line, '', ctx)).join('');
            return `<div data-likhari-layout-item style="${escapeAttr(cellStyle)}">${lines}</div>`;
          })
          .join('');
        return `<div data-likhari-layout-container style="${escapeAttr(rowStyle)}">${cells}</div>`;
      })
      .join('');
  } else {
    body = children
      .map((line, i) => {
        const couplet = Math.floor(i / 2);
        const parts: string[] = [];
        if (i % 2 === 0 && couplet > 0) parts.push(separator);
        if (layout === 'staggered') {
          parts.push(`width: ${POETRY_STAGGER_WIDTH[stagger]}`);
          parts.push(couplet % 2 === 0 ? 'margin-inline-end: auto' : 'margin-inline-start: auto');
        }
        return poetryLineToHtml(line, parts.join('; '), ctx);
      })
      .join('');
  }

  const rtl = dir === 'rtl';
  const blockStyle = [
    'box-sizing: border-box',
    'margin: 0 auto 1.4em auto',
    `max-width: ${width !== undefined ? `${width}px` : '70%'}`,
    'padding: 10px 16px',
    'text-align: justify',
    'text-align-last: justify',
    `font-size: ${rtl ? '20px' : '15px'}`,
    `line-height: ${rtl ? '2.1' : '1.6'}`,
  ].join('; ');
  const widthAttr = width !== undefined ? ` data-likhari-poetry-width="${width}"` : '';
  return `<div data-likhari-poetry-layout="${layout}" data-likhari-poetry-spacing="${spacing}" data-likhari-poetry-gutter="${gutter}" data-likhari-poetry-stagger="${stagger}"${widthAttr} dir="${dir}" style="${escapeAttr(blockStyle)}">${body}</div>`;
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

/** Lets another converter (Markdown's HTML-table fallback) number footnotes the same way. */
export function setFootnoteOrder(blocks: SNode[]): void {
  footnoteOrder = collectFootnoteOrder(blocks);
}

export function serializeHtml(state: SerializedEditorState, ctx?: ConverterContext): string {
  const blocks = rootChildren(state);
  setFootnoteOrder(blocks);
  return blocks.map((node) => nodeToHtml(node, ctx)).join('\n');
}
