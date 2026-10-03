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

export type PoetryLayout = 'single' | 'two-column';
export type PoetryAlign = 'justify' | 'left' | 'right' | 'start';
/** Vertical space between couplets — an ordered scale the menu steps through. */
export const POETRY_SPACINGS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetrySpacing = (typeof POETRY_SPACINGS)[number];
export const DEFAULT_POETRY_SPACING: PoetrySpacing = 'normal';
/** Horizontal space either side of the divider in two-column layout. */
export const POETRY_GUTTERS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetryGutter = (typeof POETRY_GUTTERS)[number];
export const DEFAULT_POETRY_GUTTER: PoetryGutter = 'normal';

const VALID_LAYOUTS = new Set<PoetryLayout>(['single', 'two-column']);
const VALID_ALIGNS = new Set<PoetryAlign>(['justify', 'left', 'right', 'start']);
const VALID_SPACINGS = new Set<PoetrySpacing>(POETRY_SPACINGS);
const VALID_GUTTERS = new Set<PoetryGutter>(POETRY_GUTTERS);

/** `text-align: justify` only stretches a line that actually wraps — a
 * misra short enough to fit on one line would otherwise just sit at its own
 * start edge instead of spreading its words across the full column width.
 * `text-align-last: justify` extends that same word-spacing stretch to the
 * single/last line too, so a one-line misra reads edge-to-edge exactly like
 * a wrapped one would. */
function applyAlignStyle(element: HTMLElement, align: PoetryAlign): void {
  element.style.textAlign = align;
  element.style.textAlignLast = align === 'justify' ? 'justify' : '';
}

/** A user-dragged width overrides editor.css's default max-width: 70% —
 * clearing the inline style (rather than setting it to that same 70%)
 * lets the CSS default keep tracking the canvas if it's ever resized. */
function applyWidthStyle(element: HTMLElement, width: number | undefined): void {
  if (width === undefined) element.style.removeProperty('max-width');
  else element.style.maxWidth = `${width}px`;
}

export type SerializedPoetryBlockNode = Spread<
  { layout: PoetryLayout; align: PoetryAlign; width?: number; spacing?: PoetrySpacing; gutter?: PoetryGutter },
  SerializedElementNode
>;

/**
 * A poetry *section*: one or more couplets (two-line verse units) sharing
 * one layout — single-column stacks each couplet's two misras directly as
 * paragraph children (two per couplet, in order), two-column gives each
 * couplet its own LayoutContainerNode row (built on the columns primitive,
 * §4.9) — see blocks/poetryActions.ts's $getCouplets for how either shape
 * is read, and $setPoetryLayout/$exitPoetryOnEnter for how children are
 * restructured/grown between couplets and layouts. `layout` and `align`
 * apply to the whole section, not per couplet; both mutate in place via
 * poetryActions so converting a section between layouts doesn't lose
 * selection/undo coherence. One extensible primitive in place of four
 * fixed templates, per requirements doc §4.11.
 */
export class PoetryBlockNode extends ElementNode {
  __layout: PoetryLayout;
  __align: PoetryAlign;
  /** User-chosen width in px (drag-resized), overriding editor.css's default
   * max-width: 70%. Undefined until the user resizes it. */
  __width?: number;
  __spacing: PoetrySpacing;
  __gutter: PoetryGutter;

  constructor(
    layout: PoetryLayout = 'single',
    align: PoetryAlign = 'justify',
    width?: number,
    spacing: PoetrySpacing = DEFAULT_POETRY_SPACING,
    gutter: PoetryGutter = DEFAULT_POETRY_GUTTER,
    key?: NodeKey,
  ) {
    super(key);
    this.__layout = layout;
    this.__align = align;
    this.__width = width;
    this.__spacing = spacing;
    this.__gutter = gutter;
  }

  static getType(): string {
    return 'poetry-couplet';
  }

  static clone(node: PoetryBlockNode): PoetryBlockNode {
    return new PoetryBlockNode(node.__layout, node.__align, node.__width, node.__spacing, node.__gutter, node.__key);
  }

  getLayout(): PoetryLayout {
    return this.getLatest().__layout;
  }

  getAlign(): PoetryAlign {
    return this.getLatest().__align;
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

  setAlign(align: PoetryAlign): this {
    const writable = this.getWritable();
    writable.__align = align;
    return writable;
  }

  static importJSON(serializedNode: SerializedPoetryBlockNode): PoetryBlockNode {
    return $createPoetryBlockNode(serializedNode.layout, serializedNode.align, serializedNode.width, serializedNode.spacing, serializedNode.gutter);
  }

  exportJSON(): SerializedPoetryBlockNode {
    const width = this.getWidth();
    return {
      ...super.exportJSON(),
      type: 'poetry-couplet',
      version: 1,
      layout: this.getLayout(),
      align: this.getAlign(),
      spacing: this.getSpacing(),
      gutter: this.getGutter(),
      ...(width !== undefined ? { width } : {}),
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        const rawLayout = domNode.getAttribute('data-likhari-poetry-layout');
        if (!rawLayout) return null;
        const layout = VALID_LAYOUTS.has(rawLayout as PoetryLayout) ? (rawLayout as PoetryLayout) : 'single';
        const rawAlign = domNode.getAttribute('data-likhari-poetry-align') ?? 'justify';
        const align = VALID_ALIGNS.has(rawAlign as PoetryAlign) ? (rawAlign as PoetryAlign) : 'justify';
        const rawWidth = Number(domNode.getAttribute('data-likhari-poetry-width'));
        const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : undefined;
        const rawSpacing = domNode.getAttribute('data-likhari-poetry-spacing');
        const spacing = VALID_SPACINGS.has(rawSpacing as PoetrySpacing) ? (rawSpacing as PoetrySpacing) : DEFAULT_POETRY_SPACING;
        const rawGutter = domNode.getAttribute('data-likhari-poetry-gutter');
        const gutter = VALID_GUTTERS.has(rawGutter as PoetryGutter) ? (rawGutter as PoetryGutter) : DEFAULT_POETRY_GUTTER;
        return { conversion: () => ({ node: $createPoetryBlockNode(layout, align, width, spacing, gutter) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-poetry-layout', this.getLayout());
    element.setAttribute('data-likhari-poetry-align', this.getAlign());
    element.setAttribute('data-likhari-poetry-spacing', this.getSpacing());
    element.setAttribute('data-likhari-poetry-gutter', this.getGutter());
    const width = this.getWidth();
    if (width !== undefined) element.setAttribute('data-likhari-poetry-width', String(width));
    applyAlignStyle(element, this.getAlign());
    applyWidthStyle(element, width);
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    const base = config.theme.poetry ?? 'likhari-poetry';
    addClassNamesToElement(element, base, `${base}--${this.__layout}`, `${base}--spacing-${this.__spacing}`, `${base}--gutter-${this.__gutter}`);
    applyAlignStyle(element, this.__align);
    applyWidthStyle(element, this.__width);
    return element;
  }

  // Only ever adds/removes the layout modifier class, never touches the
  // element's full className — the reconciler separately classList.adds the
  // per-block ltr/rtl theme class (editor.css) onto this same element, and
  // a wholesale className reassignment here would silently wipe it out.
  updateDOM(prevNode: PoetryBlockNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (prevNode.__layout !== this.__layout) {
      const base = config.theme.poetry ?? 'likhari-poetry';
      dom.classList.remove(`${base}--${prevNode.__layout}`);
      dom.classList.add(`${base}--${this.__layout}`);
    }
    if (prevNode.__spacing !== this.__spacing) {
      const base = config.theme.poetry ?? 'likhari-poetry';
      dom.classList.remove(`${base}--spacing-${prevNode.__spacing}`);
      dom.classList.add(`${base}--spacing-${this.__spacing}`);
    }
    if (prevNode.__gutter !== this.__gutter) {
      const base = config.theme.poetry ?? 'likhari-poetry';
      dom.classList.remove(`${base}--gutter-${prevNode.__gutter}`);
      dom.classList.add(`${base}--gutter-${this.__gutter}`);
    }
    if (prevNode.__align !== this.__align) {
      applyAlignStyle(dom, this.__align);
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
  align: PoetryAlign = 'justify',
  width?: number,
  spacing: PoetrySpacing = DEFAULT_POETRY_SPACING,
  gutter: PoetryGutter = DEFAULT_POETRY_GUTTER,
): PoetryBlockNode {
  return $applyNodeReplacement(new PoetryBlockNode(layout, align, width, spacing, gutter));
}

export function $isPoetryBlockNode(node: LexicalNode | null | undefined): node is PoetryBlockNode {
  return node instanceof PoetryBlockNode;
}
