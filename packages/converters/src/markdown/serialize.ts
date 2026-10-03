import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import type { SerializedEditorState } from 'lexical';
import type { ConverterContext } from '../types';
import {
  FORMAT_BOLD, FORMAT_CODE, FORMAT_HIGHLIGHT, FORMAT_ITALIC, FORMAT_STRIKETHROUGH,
  FORMAT_SUBSCRIPT, FORMAT_SUPERSCRIPT, FORMAT_UNDERLINE, rootChildren, type SNode,
} from '../shared/serialized';
import { directive, type Attrs, type MdNode } from './mdast';

const processor = unified()
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkStringify, { bullet: '-', emphasis: '*', strong: '*', rule: '-', fences: true, listItemIndent: 'one', incrementListMarker: true });

// ---------------------------------------------------------------- inline

/** Wrappers in nesting order (outermost first) so adjacent runs can share them. */
type Wrapper = { key: string; wrap: (children: MdNode[]) => MdNode };

const FORMAT_WRAPPERS: Array<[number, Wrapper]> = [
  [FORMAT_BOLD, { key: 'strong', wrap: (c) => ({ type: 'strong', children: c }) }],
  [FORMAT_ITALIC, { key: 'emphasis', wrap: (c) => ({ type: 'emphasis', children: c }) }],
  [FORMAT_STRIKETHROUGH, { key: 'delete', wrap: (c) => ({ type: 'delete', children: c }) }],
  [FORMAT_UNDERLINE, { key: 'u', wrap: (c) => directive('textDirective', 'u', {}, c) }],
  [FORMAT_SUPERSCRIPT, { key: 'sup', wrap: (c) => directive('textDirective', 'sup', {}, c) }],
  [FORMAT_SUBSCRIPT, { key: 'sub', wrap: (c) => directive('textDirective', 'sub', {}, c) }],
  [FORMAT_HIGHLIGHT, { key: 'mark', wrap: (c) => directive('textDirective', 'mark', {}, c) }],
];

const STYLE_ATTRS: Array<[string, string]> = [
  ['font-family', 'font'],
  ['font-size', 'size'],
  ['color', 'color'],
  ['background-color', 'bg'],
];

function parseStyle(style: string): Array<[string, string]> {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(':');
      return [part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()] as [string, string];
    })
    .filter(([k, v]) => k && v);
}

/** Known presentation properties become readable attributes; anything else is kept verbatim in `style`. */
export function styleToAttrs(style: string): Attrs {
  const attrs: Attrs = {};
  const rest: string[] = [];
  for (const [prop, value] of parseStyle(style)) {
    const mapped = STYLE_ATTRS.find(([p]) => p === prop);
    if (mapped) attrs[mapped[1]] = value;
    else rest.push(`${prop}: ${value}`);
  }
  if (rest.length > 0) attrs.style = rest.join('; ');
  return attrs;
}

interface Run {
  wrappers: Wrapper[];
  leaf: MdNode;
}

function runFor(node: SNode): Run {
  const format = Number(node.format ?? 0);
  const text = String(node.text ?? '');
  const wrappers: Wrapper[] = [];
  const attrs = styleToAttrs(String(node.style ?? ''));
  if (Object.keys(attrs).length > 0) {
    wrappers.push({ key: `span:${JSON.stringify(attrs)}`, wrap: (c) => directive('textDirective', 'span', attrs, c) });
  }
  for (const [bit, wrapper] of FORMAT_WRAPPERS) if (format & bit) wrappers.push(wrapper);
  const leaf: MdNode = format & FORMAT_CODE && text.trim() !== '' ? { type: 'inlineCode', value: text } : { type: 'text', value: text };
  return { wrappers, leaf };
}

const WRAPPER_TYPES = new Set(['strong', 'emphasis', 'delete', 'textDirective']);

/**
 * Markdown emphasis must hug its text (`**bold** x`, never `** bold**`), so
 * whitespace at a wrapper's edges is moved outside it. A wrapper holding only
 * whitespace dissolves into plain text.
 */
function hoistWhitespace(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (const node of nodes) {
    if (!WRAPPER_TYPES.has(node.type) || !node.children) {
      out.push(node);
      continue;
    }
    const children = hoistWhitespace(node.children);
    let lead = '';
    let trail = '';
    const first = children[0];
    if (first?.type === 'text') {
      lead = /^\s*/.exec(first.value ?? '')![0];
      first.value = (first.value ?? '').slice(lead.length);
    }
    const last = children[children.length - 1];
    if (last?.type === 'text') {
      trail = /\s*$/.exec(last.value ?? '')![0];
      last.value = (last.value ?? '').slice(0, (last.value ?? '').length - trail.length);
    }
    const kept = children.filter((c) => c.type !== 'text' || c.value !== '');
    if (lead) out.push({ type: 'text', value: lead });
    if (kept.length > 0) out.push({ ...node, children: kept });
    if (trail) out.push({ type: 'text', value: trail });
  }
  return out;
}

/** Nests consecutive runs sharing outer wrappers: `**a *b***`, not `**a****b**`. */
function buildInline(runs: Run[], depth = 0): MdNode[] {
  const out: MdNode[] = [];
  let i = 0;
  while (i < runs.length) {
    const wrapper = runs[i].wrappers[depth];
    if (!wrapper) {
      out.push(runs[i].leaf);
      i += 1;
      continue;
    }
    let j = i;
    while (j < runs.length && runs[j].wrappers[depth]?.key === wrapper.key) j += 1;
    out.push(wrapper.wrap(buildInline(runs.slice(i, j), depth + 1)));
    i = j;
  }
  return out;
}

function mergeText(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (node.type === 'text' && prev?.type === 'text') prev.value = (prev.value ?? '') + (node.value ?? '');
    else out.push(node);
  }
  return out;
}

function inlineNodes(children: SNode[], ctx?: ConverterContext): MdNode[] {
  const out: MdNode[] = [];
  let pending: Run[] = [];
  const flush = () => {
    if (pending.length > 0) out.push(...mergeText(hoistWhitespace(buildInline(pending))));
    pending = [];
  };
  for (const child of children) {
    if (child.type === 'text') {
      pending.push(runFor(child));
    } else if (child.type === 'tab') {
      pending.push({ wrappers: [], leaf: { type: 'text', value: '\t' } });
    } else if (child.type === 'linebreak') {
      flush();
      out.push({ type: 'break' });
    } else if (child.type === 'link' || child.type === 'autolink') {
      flush();
      out.push({ type: 'link', url: String(child.url ?? ''), title: child.title ? String(child.title) : null, children: inlineNodes(child.children ?? [], ctx) });
    } else if (child.type === 'footnote-reference') {
      flush();
      const id = String(child.footnoteId ?? '');
      out.push({ type: 'footnoteReference', identifier: id, label: id });
    } else if (child.children) {
      flush();
      out.push(...inlineNodes(child.children, ctx));
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- blocks

/** First strong character decides the direction a reader would infer without a hint. */
export function autoDirection(text: string): 'ltr' | 'rtl' | null {
  for (const ch of text) {
    if (/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(ch)) return 'rtl';
    if (/[A-Za-zÀ-ɏ]/.test(ch)) return 'ltr';
  }
  return null;
}

function plainText(node: SNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.children ?? []).map(plainText).join('');
}

/** `:::para{align=… dir=… indent=…}` — only emitted for what the reader could not infer. */
function withBlockAttrs(node: SNode, block: MdNode): MdNode {
  const attrs: Attrs = {};
  const format = String(node.format ?? '');
  if (format) attrs.align = format;
  const indent = Number(node.indent ?? 0);
  if (indent > 0) attrs.indent = String(indent);
  const dir = node.direction === 'rtl' || node.direction === 'ltr' ? node.direction : null;
  if (dir && dir !== (autoDirection(plainText(node)) ?? dir)) attrs.dir = dir;
  if (Object.keys(attrs).length === 0) return block;
  return directive('containerDirective', 'para', attrs, [block]);
}

function paragraphOf(children: SNode[], ctx?: ConverterContext): MdNode {
  return { type: 'paragraph', children: inlineNodes(children, ctx) };
}

function listToMd(node: SNode, ctx?: ConverterContext): MdNode {
  const listType = String(node.listType ?? 'bullet');
  const items: MdNode[] = [];
  for (const item of node.children ?? []) {
    const kids = item.children ?? [];
    const nested = kids.length === 1 && kids[0].type === 'list';
    if (nested) {
      const sub = listToMd(kids[0], ctx);
      const prev = items[items.length - 1];
      if (prev) prev.children!.push(sub);
      else items.push({ type: 'listItem', spread: false, checked: null, children: [sub] });
      continue;
    }
    items.push({
      type: 'listItem',
      spread: false,
      checked: listType === 'check' ? !!item.checked : null,
      children: [paragraphOf(kids, ctx)],
    });
  }
  return { type: 'list', ordered: listType === 'number', start: listType === 'number' ? Number(node.start ?? 1) : null, spread: false, children: items };
}

function imageToMd(node: SNode, ctx?: ConverterContext): MdNode {
  const raw = String(node.src ?? '');
  const url = ctx?.resolveImageUrl ? ctx.resolveImageUrl(raw) : raw;
  const alt = String(node.altText ?? '');
  const caption = typeof node.caption === 'string' && node.caption !== '' ? node.caption : null;
  if (caption === null && !node.width && !node.height) {
    return { type: 'paragraph', children: [{ type: 'image', url, alt, title: null }] };
  }
  const attrs: Attrs = { src: url };
  if (alt) attrs.alt = alt;
  if (node.width) attrs.width = String(node.width);
  if (node.height) attrs.height = String(node.height);
  return directive('leafDirective', 'figure', attrs, caption ? [{ type: 'text', value: caption }] : []);
}

function layoutToMd(node: SNode, ctx?: ConverterContext): MdNode {
  const items = node.children ?? [];
  const columns = items.map((item) => directive('containerDirective', 'column', {}, (item.children ?? []).flatMap((child) => blockToMd(child, ctx))));
  return directive('containerDirective', 'columns', { count: String(items.length) }, columns);
}

function poetryToMd(node: SNode, ctx?: ConverterContext): MdNode {
  const layout = node.layout === 'two-column' ? 'two-column' : 'single';
  const inner = (node.children ?? []).flatMap((child) => blockToMd(child, ctx));
  return directive('containerDirective', 'poetry', { layout }, inner);
}

function tableToMd(node: SNode, ctx?: ConverterContext): MdNode {
  const rows: MdNode[] = (node.children ?? []).map((row) => ({
    type: 'tableRow',
    children: (row.children ?? []).map((cell) => {
      // A cell's blocks are flattened into one inline run separated by line breaks.
      const parts: MdNode[] = [];
      (cell.children ?? []).forEach((block, i) => {
        if (i > 0) parts.push({ type: 'html', value: '<br>' });
        parts.push(...inlineNodes(block.children ?? [], ctx));
      });
      return { type: 'tableCell', children: parts };
    }),
  }));
  const columns = Math.max(0, ...rows.map((r) => r.children!.length));
  return { type: 'table', align: Array.from({ length: columns }, () => null), children: rows };
}

function blockToMd(node: SNode, ctx?: ConverterContext): MdNode[] {
  switch (node.type) {
    case 'paragraph': {
      const children = node.children ?? [];
      if (children.length === 0) return [];
      return [withBlockAttrs(node, paragraphOf(children, ctx))];
    }
    case 'heading': {
      const depth = Math.min(6, Math.max(1, Number(String(node.tag).slice(1)) || 2));
      return [withBlockAttrs(node, { type: 'heading', depth, children: inlineNodes(node.children ?? [], ctx) })];
    }
    case 'quote':
      return [withBlockAttrs(node, { type: 'blockquote', children: [paragraphOf(node.children ?? [], ctx)] })];
    case 'list':
      return [withBlockAttrs(node, listToMd(node, ctx))];
    case 'horizontalrule':
      return [{ type: 'thematicBreak' }];
    case 'page-break':
      return [directive('leafDirective', 'pagebreak', {})];
    case 'image':
      return [imageToMd(node, ctx)];
    case 'table':
      return [tableToMd(node, ctx)];
    case 'layout-container':
      return [layoutToMd(node, ctx)];
    case 'poetry-couplet':
      return [poetryToMd(node, ctx)];
    case 'footnote-list':
      return (node.children ?? []).map((item) => ({
        type: 'footnoteDefinition',
        identifier: String(item.footnoteId ?? ''),
        label: String(item.footnoteId ?? ''),
        children: (item.children ?? []).flatMap((child) => blockToMd(child, ctx)),
      }));
    default:
      // Fallback rule (dialect spec §6): unknown blocks keep their text as paragraphs.
      return (node.children ?? []).flatMap((child) => blockToMd(child, ctx));
  }
}

export function serializeMarkdown(state: SerializedEditorState, ctx?: ConverterContext): string {
  const tree: MdNode = { type: 'root', children: rootChildren(state).flatMap((n) => blockToMd(n, ctx)) };
  // remark-stringify consumes mdast; our MdNode is a structural subset of it.
  return String(processor.stringify(tree as never)).replace(/\n+$/, '\n').replace(/^\n+$/, '');
}
