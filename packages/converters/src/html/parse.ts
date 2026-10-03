import type { SerializedEditorState } from 'lexical';
import type { ConverterContext } from '../types';
import {
  FORMAT_BOLD, FORMAT_CODE, FORMAT_HIGHLIGHT, FORMAT_ITALIC, FORMAT_STRIKETHROUGH,
  FORMAT_SUBSCRIPT, FORMAT_SUPERSCRIPT, FORMAT_UNDERLINE, INDENT_PX,
  elementBase, makeState, paragraph, textNode, type SNode,
} from '../shared/serialized';

const ALIGNMENTS = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);

const TAG_FORMATS: Record<string, number> = {
  b: FORMAT_BOLD, strong: FORMAT_BOLD,
  i: FORMAT_ITALIC, em: FORMAT_ITALIC,
  u: FORMAT_UNDERLINE, ins: FORMAT_UNDERLINE,
  s: FORMAT_STRIKETHROUGH, strike: FORMAT_STRIKETHROUGH, del: FORMAT_STRIKETHROUGH,
  code: FORMAT_CODE, sub: FORMAT_SUBSCRIPT, sup: FORMAT_SUPERSCRIPT, mark: FORMAT_HIGHLIGHT,
};

/** Dropped with their content: never useful in a document. */
const SKIP_TAGS = new Set(['script', 'style', 'template', 'head', 'title', 'meta', 'link', 'noscript', 'iframe', 'object', 'embed']);

/** Transparent containers whose children are processed as if in place. */
const BLOCK_CONTAINERS = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'body', 'html', 'figure', 'tbody', 'thead', 'tfoot', 'details', 'summary', 'span-block']);

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
  'hr', 'pre', 'img', 'figcaption', 'dl', 'dt', 'dd', ...BLOCK_CONTAINERS,
]);

interface InlineState {
  format: number;
  style: string;
}

/** Link hrefs with an executable scheme are dropped on import. */
export function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^(javascript|vbscript|data:text\/html)/i.test(trimmed.replace(/[\u0000- ]/g, ''))) return null;
  return trimmed;
}

/** Image sources: only http(s), relative and base64 image data URIs. */
export function safeImageSrc(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (/^data:/i.test(trimmed)) return /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif|bmp);/i.test(trimmed) ? trimmed : null;
  return safeUrl(trimmed);
}

function blockExtras(el: HTMLElement): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  const dir = el.getAttribute('dir');
  if (dir === 'rtl' || dir === 'ltr') extra.direction = dir;
  const align = el.style?.textAlign;
  if (align && ALIGNMENTS.has(align)) extra.format = align;
  const padding = el.style?.paddingInlineStart || el.style?.paddingLeft || el.style?.paddingRight;
  const px = padding && /^([\d.]+)px$/.exec(padding);
  if (px) extra.indent = Math.min(Math.round(Number(px[1]) / INDENT_PX), 10);
  return extra;
}

function inlineStyleOf(el: HTMLElement): string {
  // Only carry presentation the editor itself produces (font, size, color).
  const keep: string[] = [];
  for (const prop of ['font-family', 'font-size', 'color', 'background-color']) {
    const value = el.style?.getPropertyValue(prop);
    if (value) keep.push(`${prop}: ${value}`);
  }
  return keep.join('; ');
}

function formatsFromElement(el: HTMLElement, base: InlineState): InlineState {
  let format = base.format | (TAG_FORMATS[el.tagName.toLowerCase()] ?? 0);
  const weight = el.style?.fontWeight;
  if (weight === 'bold' || Number(weight) >= 600) format |= FORMAT_BOLD;
  if (el.style?.fontStyle === 'italic') format |= FORMAT_ITALIC;
  const deco = el.style?.textDecoration || el.style?.getPropertyValue('text-decoration-line') || '';
  if (deco.includes('underline')) format |= FORMAT_UNDERLINE;
  if (deco.includes('line-through')) format |= FORMAT_STRIKETHROUGH;
  const own = inlineStyleOf(el);
  return { format, style: [base.style, own].filter(Boolean).join('; ') };
}

/** Collapse HTML whitespace like a browser does inside flowing text. */
function collapse(text: string): string {
  return text.replace(/[ \t\r\n\f]+/g, ' ');
}

function collectInline(node: Node, state: InlineState, out: SNode[], preserveWs: boolean): void {
  if (node.nodeType === 3) {
    const raw = node.nodeValue ?? '';
    const text = preserveWs ? raw : collapse(raw);
    if (text) out.push(textNode(text, state.format, state.style));
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return;
  if (tag === 'br') {
    out.push({ type: 'linebreak', version: 1 });
    return;
  }
  if (tag === 'sup' && el.hasAttribute('data-likhari-footnote-ref')) {
    out.push({ type: 'footnote-reference', version: 1, footnoteId: el.getAttribute('data-likhari-footnote-ref') ?? '' });
    return;
  }
  if (tag === 'a') {
    const url = safeUrl(el.getAttribute('href') ?? '');
    const children: SNode[] = [];
    el.childNodes.forEach((child) => collectInline(child, formatsFromElement(el, state), children, preserveWs));
    if (url === null || url === '') {
      out.push(...children);
      return;
    }
    out.push(
      elementBase('link', children, {
        url,
        rel: el.getAttribute('rel'),
        target: el.getAttribute('target'),
        title: el.getAttribute('title'),
      }),
    );
    return;
  }
  const next = formatsFromElement(el, state);
  el.childNodes.forEach((child) => collectInline(child, next, out, preserveWs));
}

/** Trim the leading/trailing space a block's source whitespace left behind. */
function trimInline(nodes: SNode[]): SNode[] {
  const first = nodes[0];
  if (first && first.type === 'text') first.text = String(first.text).replace(/^ +/, '');
  const last = nodes[nodes.length - 1];
  if (last && last.type === 'text') last.text = String(last.text).replace(/ +$/, '');
  return nodes.filter((n) => n.type !== 'text' || n.text !== '');
}

function inlineChildrenOf(el: HTMLElement, preserveWs = false): SNode[] {
  const out: SNode[] = [];
  el.childNodes.forEach((child) => collectInline(child, { format: 0, style: '' }, out, preserveWs));
  return trimInline(out);
}

/**
 * Children of a "flow" container (body, div, td, li...): runs of inline
 * content become paragraphs, block children become blocks.
 */
function flowBlocks(el: HTMLElement): SNode[] {
  const blocks: SNode[] = [];
  let run: Node[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const out: SNode[] = [];
    for (const n of run) collectInline(n, { format: 0, style: '' }, out, false);
    const children = trimInline(out);
    if (children.length > 0) blocks.push(paragraph(children));
    run = [];
  };

  el.childNodes.forEach((child) => {
    if (child.nodeType === 1) {
      const tag = (child as HTMLElement).tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) return;
      if (BLOCK_TAGS.has(tag)) {
        flush();
        blocks.push(...convertBlock(child as HTMLElement));
        return;
      }
    }
    run.push(child);
  });
  flush();
  return blocks;
}

function convertList(el: HTMLElement): SNode {
  const tag = el.tagName.toLowerCase();
  const isCheck = el.getAttribute('data-list-type') === 'check';
  const listType = isCheck ? 'check' : tag === 'ol' ? 'number' : 'bullet';
  const start = tag === 'ol' ? Number(el.getAttribute('start')) || 1 : 1;
  const items: SNode[] = [];
  el.childNodes.forEach((child) => {
    if (child.nodeType !== 1) return;
    const li = child as HTMLElement;
    if (li.tagName.toLowerCase() !== 'li') return;
    items.push(...convertListItem(li, isCheck));
  });
  return elementBase('list', items, { listType, start, tag: tag === 'ol' ? 'ol' : 'ul', ...blockExtras(el) });
}

/** One <li> may yield several listitems (inline content, then nested lists). */
function convertListItem(li: HTMLElement, isCheck: boolean): SNode[] {
  const items: SNode[] = [];
  let run: Node[] = [];
  const checked = isCheck ? li.getAttribute('data-checked') === 'true' : undefined;
  const makeItem = (children: SNode[]) =>
    elementBase('listitem', children, { value: 1, ...(isCheck ? { checked: !!checked } : {}), ...blockExtras(li) });

  const flush = () => {
    const out: SNode[] = [];
    for (const n of run) collectInline(n, { format: 0, style: '' }, out, false);
    const children = trimInline(out);
    if (children.length > 0) items.push(makeItem(children));
    run = [];
  };

  li.childNodes.forEach((child) => {
    if (child.nodeType === 1) {
      const tag = (child as HTMLElement).tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        flush();
        items.push(makeItem([convertList(child as HTMLElement)]));
        return;
      }
      if (tag === 'p') {
        // <li><p>text</p></li>: treat the paragraph as the item's own text.
        run.push(...Array.from((child as HTMLElement).childNodes));
        return;
      }
    }
    run.push(child);
  });
  flush();
  return items;
}

function convertTable(el: HTMLElement): SNode {
  const rows: SNode[] = [];
  el.querySelectorAll('tr').forEach((tr) => {
    // Skip rows of tables nested inside a cell.
    if (tr.closest('table') !== el) return;
    const cells: SNode[] = [];
    Array.from(tr.children).forEach((cell) => {
      const tag = cell.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') return;
      let children = flowBlocks(cell as HTMLElement);
      if (children.length === 0) children = [paragraph()];
      cells.push(
        elementBase('tablecell', children, {
          headerState: tag === 'th' ? 1 : 0,
          colSpan: Number(cell.getAttribute('colspan')) || 1,
          rowSpan: Number(cell.getAttribute('rowspan')) || 1,
          backgroundColor: null,
          width: null,
        }),
      );
    });
    if (cells.length > 0) rows.push(elementBase('tablerow', cells, { height: null }));
  });
  return elementBase('table', rows);
}

function convertLayout(container: HTMLElement): SNode {
  const items = Array.from(container.children)
    .filter((child) => child.hasAttribute('data-likhari-layout-item'))
    .map((item) => {
      const children = flowBlocks(item as HTMLElement);
      return elementBase('layout-item', children.length > 0 ? children : [paragraph()]);
    });
  const templateColumns = container.style.gridTemplateColumns || `repeat(${Math.max(items.length, 2)}, 1fr)`;
  return elementBase('layout-container', items.length > 0 ? items : [elementBase('layout-item', [paragraph()])], { templateColumns });
}

const POETRY_LAYOUTS = new Set(['single', 'two-column']);
const POETRY_ALIGNS = new Set(['justify', 'left', 'right', 'start']);

function convertPoetry(el: HTMLElement): SNode {
  const rawLayout = el.getAttribute('data-likhari-poetry-layout') ?? 'single';
  const layout = POETRY_LAYOUTS.has(rawLayout) ? rawLayout : 'single';
  const rawAlign = el.getAttribute('data-likhari-poetry-align') ?? 'justify';
  const align = POETRY_ALIGNS.has(rawAlign) ? rawAlign : 'justify';

  if (layout === 'two-column') {
    // One LayoutContainerNode row per couplet — grab all of them, not just
    // the first, or every couplet past the first silently disappears.
    const containerEls = Array.from(el.children).filter((c) => c.hasAttribute('data-likhari-layout-container')) as HTMLElement[];
    const containers =
      containerEls.length > 0
        ? containerEls.map((c) => convertLayout(c))
        : [
            elementBase('layout-container', [elementBase('layout-item', [paragraph()]), elementBase('layout-item', [paragraph()])], {
              templateColumns: 'repeat(2, 1fr)',
            }),
          ];
    return elementBase('poetry-couplet', containers, { layout, align });
  }

  const children = flowBlocks(el);
  return elementBase('poetry-couplet', children.length > 0 ? children : [paragraph(), paragraph()], { layout, align });
}

function convertFootnoteList(el: HTMLElement): SNode {
  const items: SNode[] = [];
  Array.from(el.children).forEach((child) => {
    if (child.tagName.toLowerCase() !== 'li') return;
    const li = child as HTMLElement;
    const footnoteId = li.getAttribute('data-likhari-footnote-item') ?? (li.getAttribute('id') ?? '').replace(/^fn-/, '');
    if (!footnoteId) return;
    // Drop the "↩" backlink our own serializer appends — it's a generated
    // affordance, not part of the note's content.
    const clone = li.cloneNode(true) as HTMLElement;
    Array.from(clone.querySelectorAll('a'))
      .filter((a) => a.getAttribute('href') === `#fnref-${footnoteId}`)
      .forEach((a) => a.remove());
    const children = flowBlocks(clone);
    items.push(elementBase('footnote-item', children.length > 0 ? children : [paragraph()], { footnoteId }));
  });
  return elementBase('footnote-list', items);
}

function convertImage(img: HTMLElement, caption: string | null): SNode | null {
  const src = safeImageSrc(img.getAttribute('src') ?? '');
  if (!src) return null;
  const dim = (name: string) => {
    const n = Number(img.getAttribute(name));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const declared = img.getAttribute('data-link-type');
  return {
    type: 'image',
    version: 1,
    src,
    altText: img.getAttribute('alt') ?? '',
    caption,
    linkType: declared === 'embedded' || /^data:/i.test(src) ? 'embedded' : 'linked',
    width: dim('width'),
    height: dim('height'),
  };
}

function convertBlock(el: HTMLElement): SNode[] {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'p':
      return [paragraph(inlineChildrenOf(el), blockExtras(el))];
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return [elementBase('heading', inlineChildrenOf(el), { tag, ...blockExtras(el) })];
    case 'blockquote': {
      const hasBlocks = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));
      if (!hasBlocks) return [elementBase('quote', inlineChildrenOf(el), blockExtras(el))];
      // Quote holds inline content only: flatten block children, one quote each.
      return flowBlocks(el).map((block) => (block.type === 'paragraph' ? elementBase('quote', block.children ?? [], blockExtras(el)) : block));
    }
    case 'pre': {
      const text = (el.textContent ?? '').replace(/\n$/, '');
      return [paragraph(text ? [textNode(text, FORMAT_CODE)] : [])];
    }
    case 'ul':
    case 'ol':
      return el.hasAttribute('data-likhari-footnote-list') ? [convertFootnoteList(el)] : [convertList(el)];
    case 'li':
      return convertListItem(el, false).length > 0 ? [elementBase('list', convertListItem(el, false), { listType: 'bullet', start: 1, tag: 'ul' })] : [];
    case 'table':
      return [convertTable(el)];
    case 'hr':
      return [{ type: 'horizontalrule', version: 1 }];
    case 'img': {
      const image = convertImage(el, null);
      return image ? [image] : [];
    }
    case 'figure': {
      const img = el.querySelector('img');
      const figcaption = el.querySelector('figcaption');
      if (!img) return flowBlocks(el);
      const caption = figcaption ? (figcaption.textContent ?? '').trim() || null : null;
      const image = convertImage(img, caption);
      return image ? [image] : [];
    }
    case 'div':
      if (el.hasAttribute('data-likhari-page-break')) return [{ type: 'page-break', version: 1 }];
      if (el.hasAttribute('data-likhari-layout-container')) return [convertLayout(el)];
      if (el.hasAttribute('data-likhari-poetry-layout')) return [convertPoetry(el)];
      return flowBlocks(el);
    case 'figcaption':
      return [];
    case 'dt': case 'dd':
      return [paragraph(inlineChildrenOf(el), blockExtras(el))];
    default:
      return flowBlocks(el);
  }
}

export function parseHtml(input: string, _ctx?: ConverterContext): SerializedEditorState {
  if (typeof DOMParser === 'undefined') {
    throw new Error('@inshapardaz/likhari-converters: HTML import needs a DOM (DOMParser); run it in a browser or jsdom.');
  }
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return makeState(flowBlocks(doc.body));
}
