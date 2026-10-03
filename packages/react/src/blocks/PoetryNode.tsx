import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  type DOMConversion,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
  ElementNode,
} from 'lexical';

export type PoetryLayout = 'single' | 'two-column' | 'staggered';
/** Vertical space between couplets — an ordered scale the menu steps through. */
export const POETRY_SPACINGS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetrySpacing = (typeof POETRY_SPACINGS)[number];
export const DEFAULT_POETRY_SPACING: PoetrySpacing = 'normal';
/** Horizontal space either side of the divider in two-column layout. */
export const POETRY_GUTTERS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetryGutter = (typeof POETRY_GUTTERS)[number];
export const DEFAULT_POETRY_GUTTER: PoetryGutter = 'normal';
/** Width of each couplet box in staggered layout, as a share of the block. */
export const POETRY_STAGGERS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetryStagger = (typeof POETRY_STAGGERS)[number];
export const DEFAULT_POETRY_STAGGER: PoetryStagger = 'normal';

const VALID_LAYOUTS = new Set<PoetryLayout>(['single', 'two-column', 'staggered']);
const VALID_SPACINGS = new Set<PoetrySpacing>(POETRY_SPACINGS);
const VALID_GUTTERS = new Set<PoetryGutter>(POETRY_GUTTERS);
const VALID_STAGGERS = new Set<PoetryStagger>(POETRY_STAGGERS);

/** Poetry is always justified: `text-align-last: justify` stretches a
 * one-line misra across the full column width too, not just wrapped lines,
 * so every line reads edge-to-edge. */
function applyJustifyStyle(element: HTMLElement): void {
  element.style.textAlign = 'justify';
  element.style.textAlignLast = 'justify';
}

/** A user-dragged width overrides editor.css's default max-width: 70% —
 * clearing the inline style (rather than setting it to that same 70%)
 * lets the CSS default keep tracking the canvas if it's ever resized. */
function applyWidthStyle(element: HTMLElement, width: number | undefined): void {
  if (width === undefined) element.style.removeProperty('max-width');
  else element.style.maxWidth = `${width}px`;
}

export type SerializedPoetryBlockNode = Spread<
  { layout: PoetryLayout; width?: number; spacing?: PoetrySpacing; gutter?: PoetryGutter; stagger?: PoetryStagger },
  SerializedElementNode
>;

/**
 * A poetry *section*: one or more couplets (two-line verse units) sharing
 * one layout — single-column stacks each couplet's two misras directly as
 * paragraph children (two per couplet, in order), two-column gives each
 * couplet its own LayoutContainerNode row (built on the columns primitive,
 * §4.9) — see blocks/poetryActions.ts's $getCouplets for how either shape
 * is read, and $setPoetryLayout/$exitPoetryOnEnter for how children are
 * restructured/grown between couplets and layouts. `layout` applies to the
 * whole section, not per couplet, and mutates in place via poetryActions so
 * converting a section between layouts doesn't lose selection/undo
 * coherence. One extensible primitive in place of four fixed templates,
 * per requirements doc §4.11.
 */
export class PoetryBlockNode extends ElementNode {
  __layout: PoetryLayout;
  /** User-chosen width in px (drag-resized), overriding editor.css's default
   * max-width: 70%. Undefined until the user resizes it. */
  __width?: number;
  __spacing: PoetrySpacing;
  __gutter: PoetryGutter;
  __stagger: PoetryStagger;

  constructor(
    layout: PoetryLayout = 'single',
    width?: number,
    spacing: PoetrySpacing = DEFAULT_POETRY_SPACING,
    gutter: PoetryGutter = DEFAULT_POETRY_GUTTER,
    stagger: PoetryStagger = DEFAULT_POETRY_STAGGER,
    key?: NodeKey,
  ) {
    super(key);
    this.__layout = layout;
    this.__width = width;
    this.__spacing = spacing;
    this.__gutter = gutter;
    this.__stagger = stagger;
  }

  static getType(): string {
    return 'poetry-couplet';
  }

  static clone(node: PoetryBlockNode): PoetryBlockNode {
    return new PoetryBlockNode(node.__layout, node.__width, node.__spacing, node.__gutter, node.__stagger, node.__key);
  }

  getLayout(): PoetryLayout {
    return this.getLatest().__layout;
  }

  getWidth(): number | undefined {
    return this.getLatest().__width;
  }

  setWidth(width: number | undefined): this {
    const writable = this.getWritable();
    writable.__width = width;
    return writable;
  }

  /** Attribute-only — restructuring children for a layout change is
   * poetryActions.ts's $setPoetryLayout, not a node method, since it needs
   * $-context tree mutations beyond this node's own state. */
  setLayoutAttribute(layout: PoetryLayout): this {
    const writable = this.getWritable();
    writable.__layout = layout;
    return writable;
  }

  getSpacing(): PoetrySpacing {
    return this.getLatest().__spacing;
  }

  setSpacing(spacing: PoetrySpacing): this {
    const writable = this.getWritable();
    writable.__spacing = spacing;
    return writable;
  }

  getGutter(): PoetryGutter {
    return this.getLatest().__gutter;
  }

  setGutter(gutter: PoetryGutter): this {
    const writable = this.getWritable();
    writable.__gutter = gutter;
    return writable;
  }

  getStagger(): PoetryStagger {
    return this.getLatest().__stagger;
  }

  setStagger(stagger: PoetryStagger): this {
    const writable = this.getWritable();
    writable.__stagger = stagger;
    return writable;
  }

  static importJSON(serializedNode: SerializedPoetryBlockNode): PoetryBlockNode {
    return $createPoetryBlockNode(serializedNode.layout, serializedNode.width, serializedNode.spacing, serializedNode.gutter, serializedNode.stagger);
  }

  exportJSON(): SerializedPoetryBlockNode {
    const width = this.getWidth();
    return {
      ...super.exportJSON(),
      type: 'poetry-couplet',
      version: 1,
      layout: this.getLayout(),
      spacing: this.getSpacing(),
      gutter: this.getGutter(),
      stagger: this.getStagger(),
      ...(width !== undefined ? { width } : {}),
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        const rawLayout = domNode.getAttribute('data-likhari-poetry-layout');
        if (!rawLayout) return null;
        const layout = VALID_LAYOUTS.has(rawLayout as PoetryLayout) ? (rawLayout as PoetryLayout) : 'single';
        const rawWidth = Number(domNode.getAttribute('data-likhari-poetry-width'));
        const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : undefined;
        const rawSpacing = domNode.getAttribute('data-likhari-poetry-spacing');
        const spacing = VALID_SPACINGS.has(rawSpacing as PoetrySpacing) ? (rawSpacing as PoetrySpacing) : DEFAULT_POETRY_SPACING;
        const rawGutter = domNode.getAttribute('data-likhari-poetry-gutter');
        const gutter = VALID_GUTTERS.has(rawGutter as PoetryGutter) ? (rawGutter as PoetryGutter) : DEFAULT_POETRY_GUTTER;
        const rawStagger = domNode.getAttribute('data-likhari-poetry-stagger');
        const stagger = VALID_STAGGERS.has(rawStagger as PoetryStagger) ? (rawStagger as PoetryStagger) : DEFAULT_POETRY_STAGGER;
        return { conversion: () => ({ node: $createPoetryBlockNode(layout, width, spacing, gutter, stagger) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-poetry-layout', this.getLayout());
    element.setAttribute('data-likhari-poetry-spacing', this.getSpacing());
    element.setAttribute('data-likhari-poetry-gutter', this.getGutter());
    element.setAttribute('data-likhari-poetry-stagger', this.getStagger());
    const width = this.getWidth();
    if (width !== undefined) element.setAttribute('data-likhari-poetry-width', String(width));
    applyJustifyStyle(element);
    applyWidthStyle(element, width);
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    const base = config.theme.poetry ?? 'likhari-poetry';
    addClassNamesToElement(element, base, `${base}--${this.__layout}`, `${base}--spacing-${this.__spacing}`, `${base}--gutter-${this.__gutter}`, `${base}--stagger-${this.__stagger}`);
    applyJustifyStyle(element);
    applyWidthStyle(element, this.__width);
    return element;
  }

  // Only ever adds/removes modifier classes, never touches the element's full
  // className — the reconciler separately classList.adds the per-block ltr/rtl
  // theme class (editor.css) onto this same element, and a wholesale className
  // reassignment here would silently wipe it out.
  updateDOM(prevNode: PoetryBlockNode, dom: HTMLElement, config: EditorConfig): boolean {
    const base = config.theme.poetry ?? 'likhari-poetry';
    if (prevNode.__layout !== this.__layout) {
      dom.classList.remove(`${base}--${prevNode.__layout}`);
      dom.classList.add(`${base}--${this.__layout}`);
    }
    if (prevNode.__spacing !== this.__spacing) {
      dom.classList.remove(`${base}--spacing-${prevNode.__spacing}`);
      dom.classList.add(`${base}--spacing-${this.__spacing}`);
    }
    if (prevNode.__gutter !== this.__gutter) {
      dom.classList.remove(`${base}--gutter-${prevNode.__gutter}`);
      dom.classList.add(`${base}--gutter-${this.__gutter}`);
    }
    if (prevNode.__stagger !== this.__stagger) {
      dom.classList.remove(`${base}--stagger-${prevNode.__stagger}`);
      dom.classList.add(`${base}--stagger-${this.__stagger}`);
    }
    if (prevNode.__width !== this.__width) {
      applyWidthStyle(dom, this.__width);
    }
    return false;
  }

  canBeEmpty(): false {
    return false;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

export function $createPoetryBlockNode(
  layout: PoetryLayout = 'single',
  width?: number,
  spacing: PoetrySpacing = DEFAULT_POETRY_SPACING,
  gutter: PoetryGutter = DEFAULT_POETRY_GUTTER,
  stagger: PoetryStagger = DEFAULT_POETRY_STAGGER,
): PoetryBlockNode {
  return $applyNodeReplacement(new PoetryBlockNode(layout, width, spacing, gutter, stagger));
}

export function $isPoetryBlockNode(node: LexicalNode | null | undefined): node is PoetryBlockNode {
  return node instanceof PoetryBlockNode;
}
