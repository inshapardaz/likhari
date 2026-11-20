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
/** Width of a centered couplet in two-column layout, as a share of the block
 * (issue #27 — was a fixed 60%; 'normal' keeps that same width). */
export const POETRY_CENTER_WIDTHS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetryCenterWidth = (typeof POETRY_CENTER_WIDTHS)[number];
export const DEFAULT_POETRY_CENTER_WIDTH: PoetryCenterWidth = 'normal';

/**
 * The verse *form* — how many misra paragraphs make up one stanza — kept
 * orthogonal to `layout` (lexical-editor-spec.md §4.11, amended): a couplet
 * is the original 2-line stanza; musaddas (6) and mukhammas (5) are
 * generalizations of the same "fixed-size stanza, add/remove like table
 * rows" model, not new node types. Scope restriction: `two-column` and
 * `staggered` stay couplet-only (see poetryActions.ts's $setPoetryLayout) —
 * a 5- or 6-line stanza only ever renders `single`.
 */
export type PoetryForm = 'couplet' | 'mukhammas' | 'musaddas';
export const POETRY_FORMS = ['couplet', 'mukhammas', 'musaddas'] as const;
export const POETRY_STANZA_SIZE: Record<PoetryForm, number> = { couplet: 2, mukhammas: 5, musaddas: 6 };
export const DEFAULT_POETRY_FORM: PoetryForm = 'couplet';

/** How many couplets share one side before the staggered layout flips —
 * generalizes the (fixed) one-couplet-per-side alternation. Only meaningful
 * for `layout === 'staggered'`, which is itself couplet-form-only. */
export type PoetryStaggerGroup = 1 | 2;
export const POETRY_STAGGER_GROUPS: readonly PoetryStaggerGroup[] = [1, 2];
export const DEFAULT_POETRY_STAGGER_GROUP: PoetryStaggerGroup = 1;

const VALID_LAYOUTS = new Set<PoetryLayout>(['single', 'two-column', 'staggered']);
const VALID_SPACINGS = new Set<PoetrySpacing>(POETRY_SPACINGS);
const VALID_GUTTERS = new Set<PoetryGutter>(POETRY_GUTTERS);
const VALID_STAGGERS = new Set<PoetryStagger>(POETRY_STAGGERS);
const VALID_CENTER_WIDTHS = new Set<PoetryCenterWidth>(POETRY_CENTER_WIDTHS);
const VALID_FORMS = new Set<PoetryForm>(POETRY_FORMS);
const VALID_STAGGER_GROUPS = new Set<PoetryStaggerGroup>(POETRY_STAGGER_GROUPS);

/** Poetry is always justified: `text-align-last: justify` stretches a
 * one-line misra across the full column width too, not just wrapped lines,
 * so every line reads edge-to-edge. */
function applyJustifyStyle(element: HTMLElement): void {
  element.style.textAlign = 'justify';
  element.style.textAlignLast = 'justify';
}

/** A user-dragged width overrides editor.css's default max-width: 70% —
 * clearing the inline style (rather than setting it to that same 70%)
 * lets the CSS default keep tracking the canvas if it's ever resized.
 * `autoWidth` (fit-content) is rendered entirely through the
 * `--width-auto` modifier class instead (see createDOM/exportDOM), so a
 * manual width is never applied on top of it — the two are mutually
 * exclusive, and autoWidth wins whenever both happen to be set (e.g. from
 * hand-edited JSON). */
function applyWidthStyle(element: HTMLElement, width: number | undefined, autoWidth: boolean): void {
  if (autoWidth || width === undefined) element.style.removeProperty('max-width');
  else element.style.maxWidth = `${width}px`;
}

export type SerializedPoetryBlockNode = Spread<
  {
    layout: PoetryLayout;
    width?: number;
    spacing?: PoetrySpacing;
    gutter?: PoetryGutter;
    stagger?: PoetryStagger;
    centerWidth?: PoetryCenterWidth;
    form?: PoetryForm;
    autoWidth?: boolean;
    staggerGroup?: PoetryStaggerGroup;
  },
  SerializedElementNode
>;

/**
 * A poetry *section*: one or more stanzas of `POETRY_STANZA_SIZE[form]`
 * misra lines sharing one layout — single-column stacks each stanza's
 * misras directly as paragraph children, two-column (couplet form only)
 * gives each couplet its own LayoutContainerNode row (built on the columns
 * primitive, §4.9) — see blocks/poetryActions.ts's $getCouplets for how
 * either shape is read, and $setPoetryLayout/$exitPoetryOnEnter for how
 * children are restructured/grown between stanzas and layouts. `layout`
 * and `form` apply to the whole section, not per stanza, and mutate in
 * place via poetryActions so converting a section between layouts/forms
 * doesn't lose selection/undo coherence. One extensible primitive in place
 * of fixed templates, per requirements doc §4.11 (amended for musaddas/
 * mukhammas and auto-width).
 */
export class PoetryBlockNode extends ElementNode {
  __layout: PoetryLayout;
  /** User-chosen width in px (drag-resized), overriding editor.css's default
   * max-width: 70%. Undefined until the user resizes it. Ignored while
   * `__autoWidth` is on. */
  __width?: number;
  __spacing: PoetrySpacing;
  __gutter: PoetryGutter;
  __stagger: PoetryStagger;
  __centerWidth: PoetryCenterWidth;
  __form: PoetryForm;
  /** `width: fit-content` instead of a max-width — only valid for
   * `layout === 'single'` (a percentage width inside a fit-content parent
   * is circular); forced back to false when the layout changes away from
   * `single` (poetryActions.ts's $setPoetryLayout). */
  __autoWidth: boolean;
  __staggerGroup: PoetryStaggerGroup;

  constructor(
    layout: PoetryLayout = 'single',
    width?: number,
    spacing: PoetrySpacing = DEFAULT_POETRY_SPACING,
    gutter: PoetryGutter = DEFAULT_POETRY_GUTTER,
    stagger: PoetryStagger = DEFAULT_POETRY_STAGGER,
    centerWidth: PoetryCenterWidth = DEFAULT_POETRY_CENTER_WIDTH,
    form: PoetryForm = DEFAULT_POETRY_FORM,
    autoWidth: boolean = false,
    staggerGroup: PoetryStaggerGroup = DEFAULT_POETRY_STAGGER_GROUP,
    key?: NodeKey,
  ) {
    super(key);
    this.__layout = layout;
    this.__width = width;
    this.__spacing = spacing;
    this.__gutter = gutter;
    this.__stagger = stagger;
    this.__centerWidth = centerWidth;
    this.__form = form;
    this.__autoWidth = autoWidth;
    this.__staggerGroup = staggerGroup;
  }

  static getType(): string {
    return 'poetry-couplet';
  }

  static clone(node: PoetryBlockNode): PoetryBlockNode {
    return new PoetryBlockNode(
      node.__layout,
      node.__width,
      node.__spacing,
      node.__gutter,
      node.__stagger,
      node.__centerWidth,
      node.__form,
      node.__autoWidth,
      node.__staggerGroup,
      node.__key,
    );
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

  getCenterWidth(): PoetryCenterWidth {
    return this.getLatest().__centerWidth;
  }

  setCenterWidth(centerWidth: PoetryCenterWidth): this {
    const writable = this.getWritable();
    writable.__centerWidth = centerWidth;
    return writable;
  }

  getForm(): PoetryForm {
    return this.getLatest().__form;
  }

  /** Attribute-only, same split as setLayoutAttribute — restructuring
   * children to a new stanza size is poetryActions.ts's job. */
  setFormAttribute(form: PoetryForm): this {
    const writable = this.getWritable();
    writable.__form = form;
    return writable;
  }

  getAutoWidth(): boolean {
    return this.getLatest().__autoWidth;
  }

  setAutoWidth(autoWidth: boolean): this {
    const writable = this.getWritable();
    writable.__autoWidth = autoWidth;
    return writable;
  }

  getStaggerGroup(): PoetryStaggerGroup {
    return this.getLatest().__staggerGroup;
  }

  setStaggerGroup(staggerGroup: PoetryStaggerGroup): this {
    const writable = this.getWritable();
    writable.__staggerGroup = staggerGroup;
    return writable;
  }

  // Validated the same way the DOM import below validates its attributes
  // (issue #29) — hand-edited or otherwise untrusted JSON could carry any
  // string here, which would otherwise add an unknown CSS modifier class
  // and render with no style for that setting. Missing `form`/`autoWidth`/
  // `staggerGroup` (a document saved before this feature existed) falls
  // back to their defaults, which reproduce today's couplet rendering
  // exactly — the backward-compatibility bar for this change.
  static importJSON(serializedNode: SerializedPoetryBlockNode): PoetryBlockNode {
    const layout = VALID_LAYOUTS.has(serializedNode.layout) ? serializedNode.layout : 'single';
    const width = typeof serializedNode.width === 'number' && serializedNode.width > 0 ? serializedNode.width : undefined;
    const spacing = VALID_SPACINGS.has(serializedNode.spacing as PoetrySpacing) ? (serializedNode.spacing as PoetrySpacing) : DEFAULT_POETRY_SPACING;
    const gutter = VALID_GUTTERS.has(serializedNode.gutter as PoetryGutter) ? (serializedNode.gutter as PoetryGutter) : DEFAULT_POETRY_GUTTER;
    const stagger = VALID_STAGGERS.has(serializedNode.stagger as PoetryStagger) ? (serializedNode.stagger as PoetryStagger) : DEFAULT_POETRY_STAGGER;
    const centerWidth = VALID_CENTER_WIDTHS.has(serializedNode.centerWidth as PoetryCenterWidth)
      ? (serializedNode.centerWidth as PoetryCenterWidth)
      : DEFAULT_POETRY_CENTER_WIDTH;
    const form = VALID_FORMS.has(serializedNode.form as PoetryForm) ? (serializedNode.form as PoetryForm) : DEFAULT_POETRY_FORM;
    const autoWidth = serializedNode.autoWidth === true && layout === 'single';
    const staggerGroup = VALID_STAGGER_GROUPS.has(serializedNode.staggerGroup as PoetryStaggerGroup)
      ? (serializedNode.staggerGroup as PoetryStaggerGroup)
      : DEFAULT_POETRY_STAGGER_GROUP;
    return $createPoetryBlockNode(layout, width, spacing, gutter, stagger, centerWidth, form, autoWidth, staggerGroup);
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
      centerWidth: this.getCenterWidth(),
      form: this.getForm(),
      autoWidth: this.getAutoWidth(),
      staggerGroup: this.getStaggerGroup(),
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
        const rawCenterWidth = domNode.getAttribute('data-likhari-poetry-center-width');
        const centerWidth = VALID_CENTER_WIDTHS.has(rawCenterWidth as PoetryCenterWidth)
          ? (rawCenterWidth as PoetryCenterWidth)
          : DEFAULT_POETRY_CENTER_WIDTH;
        const rawForm = domNode.getAttribute('data-likhari-poetry-form');
        const form = VALID_FORMS.has(rawForm as PoetryForm) ? (rawForm as PoetryForm) : DEFAULT_POETRY_FORM;
        const autoWidth = domNode.getAttribute('data-likhari-poetry-auto-width') === 'true' && layout === 'single';
        const rawStaggerGroup = Number(domNode.getAttribute('data-likhari-poetry-stagger-group'));
        const staggerGroup = VALID_STAGGER_GROUPS.has(rawStaggerGroup as PoetryStaggerGroup)
          ? (rawStaggerGroup as PoetryStaggerGroup)
          : DEFAULT_POETRY_STAGGER_GROUP;
        return { conversion: () => ({ node: $createPoetryBlockNode(layout, width, spacing, gutter, stagger, centerWidth, form, autoWidth, staggerGroup) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-poetry-layout', this.getLayout());
    element.setAttribute('data-likhari-poetry-spacing', this.getSpacing());
    element.setAttribute('data-likhari-poetry-gutter', this.getGutter());
    element.setAttribute('data-likhari-poetry-stagger', this.getStagger());
    element.setAttribute('data-likhari-poetry-center-width', this.getCenterWidth());
    element.setAttribute('data-likhari-poetry-form', this.getForm());
    element.setAttribute('data-likhari-poetry-auto-width', String(this.getAutoWidth()));
    element.setAttribute('data-likhari-poetry-stagger-group', String(this.getStaggerGroup()));
    const width = this.getWidth();
    if (width !== undefined) element.setAttribute('data-likhari-poetry-width', String(width));
    applyJustifyStyle(element);
    applyWidthStyle(element, width, this.getAutoWidth());
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    const base = config.theme.poetry ?? 'likhari-poetry';
    addClassNamesToElement(
      element,
      base,
      `${base}--${this.__layout}`,
      `${base}--spacing-${this.__spacing}`,
      `${base}--gutter-${this.__gutter}`,
      `${base}--stagger-${this.__stagger}`,
      `${base}--center-${this.__centerWidth}`,
      `${base}--form-${this.__form}`,
      `${base}--stagger-group-${this.__staggerGroup}`,
    );
    if (this.__autoWidth) element.classList.add(`${base}--width-auto`);
    applyJustifyStyle(element);
    applyWidthStyle(element, this.__width, this.__autoWidth);
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
    if (prevNode.__centerWidth !== this.__centerWidth) {
      dom.classList.remove(`${base}--center-${prevNode.__centerWidth}`);
      dom.classList.add(`${base}--center-${this.__centerWidth}`);
    }
    if (prevNode.__form !== this.__form) {
      dom.classList.remove(`${base}--form-${prevNode.__form}`);
      dom.classList.add(`${base}--form-${this.__form}`);
    }
    if (prevNode.__staggerGroup !== this.__staggerGroup) {
      dom.classList.remove(`${base}--stagger-group-${prevNode.__staggerGroup}`);
      dom.classList.add(`${base}--stagger-group-${this.__staggerGroup}`);
    }
    if (prevNode.__autoWidth !== this.__autoWidth) {
      dom.classList.toggle(`${base}--width-auto`, this.__autoWidth);
    }
    if (prevNode.__width !== this.__width || prevNode.__autoWidth !== this.__autoWidth) {
      applyWidthStyle(dom, this.__width, this.__autoWidth);
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
  centerWidth: PoetryCenterWidth = DEFAULT_POETRY_CENTER_WIDTH,
  form: PoetryForm = DEFAULT_POETRY_FORM,
  autoWidth: boolean = false,
  staggerGroup: PoetryStaggerGroup = DEFAULT_POETRY_STAGGER_GROUP,
): PoetryBlockNode {
  return $applyNodeReplacement(new PoetryBlockNode(layout, width, spacing, gutter, stagger, centerWidth, form, autoWidth, staggerGroup));
}

export function $isPoetryBlockNode(node: LexicalNode | null | undefined): node is PoetryBlockNode {
  return node instanceof PoetryBlockNode;
}
