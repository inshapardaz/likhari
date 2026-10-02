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

const VALID_LAYOUTS = new Set<PoetryLayout>(['single', 'two-column']);
const VALID_ALIGNS = new Set<PoetryAlign>(['justify', 'left', 'right', 'start']);

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

export type SerializedPoetryBlockNode = Spread<{ layout: PoetryLayout; align: PoetryAlign }, SerializedElementNode>;

/**
 * A couplet (two-line verse unit), the one extensible primitive requirements
 * doc §4.11 recommends in place of four fixed templates. `layout` picks
 * single-column (two stacked misras) vs. two-column (built on the columns
 * primitive, §4.9 — see blocks/poetryActions.ts for how children are
 * restructured between the two); `align` is a literal per-instance override,
 * independent of the document's own alignment setting (architecture doc
 * §3.1). Both mutate in place via poetryActions so converting a couplet
 * between layouts doesn't lose selection/undo coherence.
 */
export class PoetryBlockNode extends ElementNode {
  __layout: PoetryLayout;
  __align: PoetryAlign;

  constructor(layout: PoetryLayout = 'single', align: PoetryAlign = 'justify', key?: NodeKey) {
    super(key);
    this.__layout = layout;
    this.__align = align;
  }

  static getType(): string {
    return 'poetry-couplet';
  }

  static clone(node: PoetryBlockNode): PoetryBlockNode {
    return new PoetryBlockNode(node.__layout, node.__align, node.__key);
  }

  getLayout(): PoetryLayout {
    return this.getLatest().__layout;
  }

  getAlign(): PoetryAlign {
    return this.getLatest().__align;
  }

  /** Attribute-only — restructuring children for a layout change is
   * poetryActions.ts's $setPoetryLayout, not a node method, since it needs
   * $-context tree mutations beyond this node's own state. */
  setLayoutAttribute(layout: PoetryLayout): this {
    const writable = this.getWritable();
    writable.__layout = layout;
    return writable;
  }

  setAlign(align: PoetryAlign): this {
    const writable = this.getWritable();
    writable.__align = align;
    return writable;
  }

  static importJSON(serializedNode: SerializedPoetryBlockNode): PoetryBlockNode {
    return $createPoetryBlockNode(serializedNode.layout, serializedNode.align);
  }

  exportJSON(): SerializedPoetryBlockNode {
    return { ...super.exportJSON(), type: 'poetry-couplet', version: 1, layout: this.getLayout(), align: this.getAlign() };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        const rawLayout = domNode.getAttribute('data-likhari-poetry-layout');
        if (!rawLayout) return null;
        const layout = VALID_LAYOUTS.has(rawLayout as PoetryLayout) ? (rawLayout as PoetryLayout) : 'single';
        const rawAlign = domNode.getAttribute('data-likhari-poetry-align') ?? 'justify';
        const align = VALID_ALIGNS.has(rawAlign as PoetryAlign) ? (rawAlign as PoetryAlign) : 'justify';
        return { conversion: () => ({ node: $createPoetryBlockNode(layout, align) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-poetry-layout', this.getLayout());
    element.setAttribute('data-likhari-poetry-align', this.getAlign());
    applyAlignStyle(element, this.getAlign());
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    const base = config.theme.poetry ?? 'likhari-poetry';
    addClassNamesToElement(element, base, `${base}--${this.__layout}`);
    applyAlignStyle(element, this.__align);
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
    if (prevNode.__align !== this.__align) {
      applyAlignStyle(dom, this.__align);
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

export function $createPoetryBlockNode(layout: PoetryLayout = 'single', align: PoetryAlign = 'justify'): PoetryBlockNode {
  return $applyNodeReplacement(new PoetryBlockNode(layout, align));
}

export function $isPoetryBlockNode(node: LexicalNode | null | undefined): node is PoetryBlockNode {
  return node instanceof PoetryBlockNode;
}
