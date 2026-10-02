import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import type { SerializedEditorState } from 'lexical';
import type { ConverterContext } from '../types';
import {
  FORMAT_BOLD, FORMAT_CODE, FORMAT_HIGHLIGHT, FORMAT_ITALIC, FORMAT_STRIKETHROUGH,
  FORMAT_SUBSCRIPT, FORMAT_SUPERSCRIPT, FORMAT_UNDERLINE,
  elementBase, makeState, paragraph, textNode, type SNode,
} from '../shared/serialized';
import { safeImageSrc, safeUrl } from '../html/parse';
import type { MdNode } from './mdast';

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

const ALIGNMENTS = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

interface InlineState {
  format: number;
  style: string;
}

const DIRECTIVE_FORMATS: Record<string, number> = {
  u: FORMAT_UNDERLINE,
  sup: FORMAT_SUPERSCRIPT,
  sub: FORMAT_SUBSCRIPT,
  mark: FORMAT_HIGHLIGHT,
};

/** Inverse of the serializer's `styleToAttrs`. */
function attrsToStyle(attrs: Record<string, string | null | undefined>): string {
  const parts: string[] = [];
  const map: Array<[string, string]> = [['font', 'font-family'], ['size', 'font-size'], ['color', 'color'], ['bg', 'background-color']];
  for (const [attr, prop] of map) {
    const value = attrs[attr];
    // A value that could break out of the declaration is dropped.
    if (value && !/[;{}<>]/.test(value)) parts.push(`${prop}: ${value}`);
  }
  if (attrs.style && !/[{}<>]/.test(attrs.style)) parts.push(attrs.style);
  return parts.join('; ');
}

function inline(nodes: MdNode[], state: InlineState, out: SNode[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        if (node.value) out.push(textNode(node.value, state.format, state.style));
        break;
      case 'strong':
        inline(node.children ?? [], { ...state, format: state.format | FORMAT_BOLD }, out);
        break;
      case 'emphasis':
        inline(node.children ?? [], { ...state, format: state.format | FORMAT_ITALIC }, out);
        break;
      case 'delete':
        inline(node.children ?? [], { ...state, format: state.format | FORMAT_STRIKETHROUGH }, out);
        break;
      case 'inlineCode':
        if (node.value) out.push(textNode(node.value, state.format | FORMAT_CODE, state.style));
        break;
      case 'break':
        out.push({ type: 'linebreak', version: 1 });
        break;
      case 'html':
        // A literal <br> (how the serializer writes a line break inside a table cell).
        if (/^<br\s*\/?>$/i.test((node.value ?? '').trim())) out.push({ type: 'linebreak', version: 1 });
        break;
      case 'link': {
        const url = safeUrl(node.url ?? '');
        const children: SNode[] = [];
        inline(node.children ?? [], state, children);
        if (!url) out.push(...children);
        else out.push(elementBase('link', children, { url, rel: null, target: null, title: node.title ?? null }));
        break;
      }
      case 'footnoteReference':
        out.push({ type: 'footnote-reference', version: 1, footnoteId: node.identifier ?? '' });
        break;
      case 'textDirective': {
        const name = node.name ?? '';
        if (name === 'span') {
          const style = attrsToStyle(node.attributes ?? {});
          inline(node.children ?? [], { ...state, style: [state.style, style].filter(Boolean).join('; ') }, out);
        } else {
          inline(node.children ?? [], { ...state, format: state.format | (DIRECTIVE_FORMATS[name] ?? 0) }, out);
        }
        break;
      }
      default:
        // Images inside a text run are lifted out by the caller; references
        // and unknown inline nodes keep their text.
        if (node.children) inline(node.children, state, out);
        else if (node.value) out.push(textNode(node.value, state.format, state.style));
    }
  }
}

function inlineOf(nodes: MdNode[]): SNode[] {
  const out: SNode[] = [];
  inline(nodes, { format: 0, style: '' }, out);
  // Merge neighbours that ended up with identical formatting (e.g. around a restored ":30").
  return out.reduce<SNode[]>((acc, n) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.type === 'text' && n.type === 'text' && prev.format === n.format && prev.style === n.style) prev.text = String(prev.text) + String(n.text);
    else acc.push(n);
    return acc;
  }, []);
}

function imageBlock(node: MdNode): SNode | null {
  const src = safeImageSrc(node.url ?? '');
  if (!src) return null;
  return {
    type: 'image', version: 1, src, altText: node.alt ?? '', caption: null,
    linkType: /^data:/i.test(src) ? 'embedded' : 'linked', width: null, height: null,
  };
}

/** A paragraph's images become block images; text between them stays paragraphs. */
function paragraphBlocks(node: MdNode, extra: Record<string, unknown>): SNode[] {
  const blocks: SNode[] = [];
  let run: MdNode[] = [];
  const flush = () => {
    const children = inlineOf(run);
    if (children.length > 0) blocks.push(paragraph(children, extra));
    run = [];
  };
  for (const child of node.children ?? []) {
    if (child.type === 'image') {
      flush();
      const image = imageBlock(child);
      if (image) blocks.push(image);
    } else run.push(child);
  }
  flush();
  return blocks;
}

function listBlock(node: MdNode, extra: Record<string, unknown>): SNode {
  const isCheck = (node.children ?? []).some((item) => typeof item.checked === 'boolean');
  const listType = isCheck ? 'check' : node.ordered ? 'number' : 'bullet';
  const items: SNode[] = [];
  for (const item of node.children ?? []) {
    const textParts: MdNode[] = [];
    const flush = () => {
      if (textParts.length === 0) return;
      const children: SNode[] = [];
      textParts.forEach((p, i) => {
        if (i > 0) children.push({ type: 'linebreak', version: 1 });
        children.push(...inlineOf(p.children ?? []));
      });
      items.push(elementBase('listitem', children, { value: 1, ...(isCheck ? { checked: item.checked === true } : {}) }));
      textParts.length = 0;
    };
    for (const child of item.children ?? []) {
      if (child.type === 'list') {
        flush();
        items.push(elementBase('listitem', [listBlock(child, {})], { value: 1 }));
      } else if (child.type === 'paragraph') textParts.push(child);
      else if (child.children) textParts.push({ type: 'paragraph', children: child.children });
    }
    flush();
  }
  return elementBase('list', items, { listType, start: node.ordered ? node.start ?? 1 : 1, tag: node.ordered ? 'ol' : 'ul', ...extra });
}

function tableBlock(node: MdNode): SNode {
  const rows = (node.children ?? []).map((row, rowIndex) =>
    elementBase(
      'tablerow',
      (row.children ?? []).map((cell) =>
        elementBase('tablecell', [paragraph(inlineOf(cell.children ?? []))], {
          headerState: rowIndex === 0 ? 1 : 0, colSpan: 1, rowSpan: 1, backgroundColor: null, width: null,
        }),
      ),
      { height: null },
    ),
  );
  return elementBase('table', rows);
}

function blockExtras(attrs: Record<string, string | null | undefined>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (attrs.align && ALIGNMENTS.has(attrs.align)) extra.format = attrs.align;
  if (attrs.dir === 'rtl' || attrs.dir === 'ltr') extra.direction = attrs.dir;
  const indent = Number(attrs.indent);
  if (Number.isInteger(indent) && indent > 0) extra.indent = Math.min(indent, 10);
  return extra;
}

function dim(value: string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function blocks(nodes: MdNode[], extra: Record<string, unknown> = {}): SNode[] {
  const out: SNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out.push(...paragraphBlocks(node, extra));
        break;
      case 'heading':
        out.push(elementBase('heading', inlineOf(node.children ?? []), { tag: `h${Math.min(6, Math.max(1, node.depth ?? 2))}`, ...extra }));
        break;
      case 'blockquote':
        for (const child of node.children ?? []) {
          if (child.type === 'paragraph') out.push(elementBase('quote', inlineOf(child.children ?? []), extra));
          else out.push(...blocks([child]));
        }
        break;
      case 'list':
        out.push(listBlock(node, extra));
        break;
      case 'code': {
        const lines = (node.value ?? '').split('\n');
        const children: SNode[] = [];
        lines.forEach((line, i) => {
          if (i > 0) children.push({ type: 'linebreak', version: 1 });
          if (line) children.push(textNode(line, FORMAT_CODE));
        });
        out.push(paragraph(children, extra));
        break;
      }
      case 'thematicBreak':
        out.push({ type: 'horizontalrule', version: 1 });
        break;
      case 'table':
        out.push(tableBlock(node));
        break;
      case 'containerDirective':
        if (node.name === 'columns') {
          const columns = (node.children ?? [])
            .filter((c) => c.type === 'containerDirective' && c.name === 'column')
            .map((c) => {
              const children = blocks(c.children ?? []);
              return elementBase('layout-item', children.length > 0 ? children : [paragraph()]);
            });
          if (columns.length > 0) {
            out.push(elementBase('layout-container', columns, { templateColumns: `repeat(${columns.length}, 1fr)` }));
          }
        } else if (node.name === 'poetry') {
          const attrs = node.attributes ?? {};
          const layout = attrs.layout === 'two-column' ? 'two-column' : 'single';
          const align = ALIGNMENTS.has(attrs.align ?? '') ? (attrs.align as string) : 'justify';
          const children = blocks(node.children ?? []);
          out.push(elementBase('poetry-couplet', children.length > 0 ? children : [paragraph(), paragraph()], { layout, align }));
        } else {
          // Unknown containers (including a stray "column" outside "columns")
          // are transparent: their content is kept.
          out.push(...blocks(node.children ?? [], node.name === 'para' ? blockExtras(node.attributes ?? {}) : extra));
        }
        break;
      case 'leafDirective': {
        if (node.name === 'pagebreak') out.push({ type: 'page-break', version: 1 });
        else if (node.name === 'figure') {
          const attrs = node.attributes ?? {};
          const src = safeImageSrc(attrs.src ?? '');
          if (src) {
            const caption = inlineOf(node.children ?? []).map((n) => String(n.text ?? '')).join('');
            out.push({
              type: 'image', version: 1, src, altText: attrs.alt ?? '', caption: caption || null,
              linkType: /^data:/i.test(src) ? 'embedded' : 'linked', width: dim(attrs.width), height: dim(attrs.height),
            });
          }
        }
        break;
      }
      case 'html':
      case 'definition':
      case 'yaml':
        break; // raw HTML, link definitions and front matter carry no editable content
      default:
        if (node.children) out.push(...blocks(node.children, extra));
        else if (node.value) out.push(paragraph([textNode(node.value)], extra));
    }
  }
  return out;
}

const KNOWN_TEXT_DIRECTIVES = new Set(['span', ...Object.keys(DIRECTIVE_FORMATS)]);

/**
 * `remark-directive` reads any `:word` as a directive ("10:30", "a:b"), which
 * would silently eat ordinary prose. Directives the dialect doesn't define
 * are turned back into the literal source text.
 */
function restoreUnknownDirectives(node: MdNode & { position?: { start: { offset?: number }; end: { offset?: number } } }, source: string): void {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    const c = child as MdNode & { position?: { start: { offset?: number }; end: { offset?: number } } };
    const unknownText = c.type === 'textDirective' && !KNOWN_TEXT_DIRECTIVES.has(c.name ?? '');
    const unknownLeaf = c.type === 'leafDirective' && c.name !== 'pagebreak' && c.name !== 'figure';
    if ((unknownText || unknownLeaf) && c.position?.start.offset !== undefined && c.position.end.offset !== undefined) {
      const raw = source.slice(c.position.start.offset, c.position.end.offset);
      return unknownLeaf ? { type: 'paragraph', children: [{ type: 'text', value: raw }] } : { type: 'text', value: raw };
    }
    restoreUnknownDirectives(c, source);
    return c;
  });
}

/** Footnote definitions are always top-level in CommonMark/GFM (never nested
 * inside a list/quote/etc.), wherever in the source they appear — so unlike
 * everything else `blocks()` handles, they're pulled out before the normal
 * recursive walk and collected into the one footnote-list our editor model
 * expects, instead of staying scattered where the source happened to put them. */
function extractFootnoteList(topLevel: MdNode[]): SNode | null {
  const defs = topLevel.filter((node) => node.type === 'footnoteDefinition');
  if (defs.length === 0) return null;
  const items = defs.map((def) =>
    elementBase('footnote-item', blocks(def.children ?? []), { footnoteId: def.identifier ?? '' }),
  );
  return elementBase('footnote-list', items);
}

export function parseMarkdown(input: string, _ctx?: ConverterContext): SerializedEditorState {
  const tree = processor.parse(input) as unknown as MdNode;
  restoreUnknownDirectives(tree, input);
  const topLevel = tree.children ?? [];
  const footnoteList = extractFootnoteList(topLevel);
  const body = blocks(topLevel.filter((node) => node.type !== 'footnoteDefinition'));
  return makeState(footnoteList ? [...body, footnoteList] : body);
}
