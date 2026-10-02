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

export type SerializedPoetryCoupletNode = Spread<{ centered: boolean }, SerializedElementNode>;

/**
 * One couplet's two misra lines, wrapped so each couplet can carry its own
 * rendering override independent of its PoetryBlockNode's overall layout —
 * currently just `centered` (a narrower box, centered on the page, instead
 * of the block's default width): "two columns with a couplet that is
 * single, aligned centered" mixes LayoutContainerNode rows (two-column
 * couplets) with centered PoetryCoupletNodes in the same block, each
 * couplet choosing independently.
 *
 * Used for single-column and alternating block layouts; a two-column
 * couplet uses LayoutContainerNode instead (its own two-item row already
 * gives it a natural per-couplet box, so it doesn't need this wrapper).
 */
export class PoetryCoupletNode extends ElementNode {
  __centered: boolean;

  constructor(centered = false, key?: NodeKey) {
    super(key);
    this.__centered = centered;
  }

  static getType(): string {
    return 'poetry-couplet';
  }

  static clone(node: PoetryCoupletNode): PoetryCoupletNode {
    return new PoetryCoupletNode(node.__centered, node.__key);
  }

  getCentered(): boolean {
    return this.getLatest().__centered;
  }

  setCentered(centered: boolean): this {
    const writable = this.getWritable();
    writable.__centered = centered;
    return writable;
  }

  static importJSON(serializedNode: SerializedPoetryCoupletNode): PoetryCoupletNode {
    return $createPoetryCoupletNode(serializedNode.centered);
  }

  exportJSON(): SerializedPoetryCoupletNode {
    return { ...super.exportJSON(), type: 'poetry-couplet', version: 1, centered: this.getCentered() };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        if (!domNode.hasAttribute('data-likhari-poetry-couplet')) return null;
        const centered = domNode.getAttribute('data-likhari-poetry-couplet-centered') === 'true';
        return { conversion: () => ({ node: $createPoetryCoupletNode(centered) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-poetry-couplet', '');
    if (this.getCentered()) element.setAttribute('data-likhari-poetry-couplet-centered', 'true');
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    const base = config.theme.poetryCouplet ?? 'likhari-poetry-couplet';
    addClassNamesToElement(element, base);
    if (this.__centered) element.classList.add(`${base}--centered`);
    return element;
  }

  updateDOM(prevNode: PoetryCoupletNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (prevNode.__centered !== this.__centered) {
      const base = config.theme.poetryCouplet ?? 'likhari-poetry-couplet';
      dom.classList.toggle(`${base}--centered`, this.__centered);
    }
    return false;
  }

  canBeEmpty(): false {
    return false;
  }

  canIndent(): false {
    return false;
  }
}

export function $createPoetryCoupletNode(centered = false): PoetryCoupletNode {
  return $applyNodeReplacement(new PoetryCoupletNode(centered));
}

export function $isPoetryCoupletNode(node: LexicalNode | null | undefined): node is PoetryCoupletNode {
  return node instanceof PoetryCoupletNode;
}
