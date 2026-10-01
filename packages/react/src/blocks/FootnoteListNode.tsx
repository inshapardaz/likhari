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

export type SerializedFootnoteListNode = SerializedElementNode;
export type SerializedFootnoteItemNode = Spread<{ footnoteId: string }, SerializedElementNode>;

/** The document's single footnote list, rendered at the end (requirements
 * doc §4.10). An ordered-list-like container of FootnoteItemNode; its items'
 * displayed numbers are a CSS counter (editor.css), same mechanism as
 * FootnoteReferenceNode, so both sequences stay in sync as long as items
 * are appended in the same order their references were inserted — which
 * FootnotePlugin's insert command always does. */
export class FootnoteListNode extends ElementNode {
  static getType(): string {
    return 'footnote-list';
  }

  static clone(node: FootnoteListNode): FootnoteListNode {
    return new FootnoteListNode(node.__key);
  }

  static importJSON(): FootnoteListNode {
    return $createFootnoteListNode();
  }

  exportJSON(): SerializedFootnoteListNode {
    return { ...super.exportJSON(), type: 'footnote-list', version: 1 };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      ol: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        if (!domNode.hasAttribute('data-likhari-footnote-list')) return null;
        return { conversion: () => ({ node: $createFootnoteListNode() }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('ol');
    element.setAttribute('data-likhari-footnote-list', '');
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('ol');
    addClassNamesToElement(element, config.theme.footnoteList ?? 'likhari-footnote-list');
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  isShadowRoot(): boolean {
    return true;
  }

  insertNewAfter(): null {
    return null;
  }
}

export function $createFootnoteListNode(): FootnoteListNode {
  return $applyNodeReplacement(new FootnoteListNode());
}

export function $isFootnoteListNode(node: LexicalNode | null | undefined): node is FootnoteListNode {
  return node instanceof FootnoteListNode;
}

/** One entry in the FootnoteListNode — the editable note text for a given
 * footnoteId. Always keeps at least an empty paragraph (mirrors
 * TableCellNode/LayoutItemNode). */
export class FootnoteItemNode extends ElementNode {
  __footnoteId: string;

  constructor(footnoteId: string, key?: NodeKey) {
    super(key);
    this.__footnoteId = footnoteId;
  }

  static getType(): string {
    return 'footnote-item';
  }

  static clone(node: FootnoteItemNode): FootnoteItemNode {
    return new FootnoteItemNode(node.__footnoteId, node.__key);
  }

  getFootnoteId(): string {
    return this.getLatest().__footnoteId;
  }

  static importJSON(serializedNode: SerializedFootnoteItemNode): FootnoteItemNode {
    return $createFootnoteItemNode(serializedNode.footnoteId);
  }

  exportJSON(): SerializedFootnoteItemNode {
    return { ...super.exportJSON(), type: 'footnote-item', version: 1, footnoteId: this.getFootnoteId() };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      li: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        const id = domNode.getAttribute('data-likhari-footnote-item');
        if (!id) return null;
        return { conversion: () => ({ node: $createFootnoteItemNode(id) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('li');
    element.setAttribute('id', `fn-${this.getFootnoteId()}`);
    element.setAttribute('data-likhari-footnote-item', this.getFootnoteId());
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('li');
    addClassNamesToElement(element, config.theme.footnoteItem ?? 'likhari-footnote-item');
    element.id = `fn-${this.getFootnoteId()}`;
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  canBeEmpty(): false {
    return false;
  }

  canIndent(): false {
    return false;
  }
}

export function $createFootnoteItemNode(footnoteId: string): FootnoteItemNode {
  return $applyNodeReplacement(new FootnoteItemNode(footnoteId));
}

export function $isFootnoteItemNode(node: LexicalNode | null | undefined): node is FootnoteItemNode {
  return node instanceof FootnoteItemNode;
}
