import type { ReactElement } from 'react';
import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $getNodeByKey,
  createCommand,
  DecoratorNode,
  type DOMConversion,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type EditorState,
  type LexicalCommand,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';

export const INSERT_FOOTNOTE_COMMAND: LexicalCommand<void> = createCommand('INSERT_FOOTNOTE_COMMAND');

export type SerializedFootnoteReferenceNode = Spread<{ footnoteId: string }, SerializedLexicalNode>;

/** Inline marker in the text flow (requirements doc §4.10, architecture doc
 * §3.3). Holds only an id — its displayed number is never stored, it's
 * rendered by a CSS counter (editor.css) that counts these markers in DOM
 * order, so insert/delete/reorder auto-renumbers with no JS bookkeeping.
 * The note's actual content lives in a matching FootnoteItemNode inside the
 * document's single FootnoteListNode, not here (same split as Lexical's own
 * comments/annotations pattern: reference in the flow, content out-of-band). */
export class FootnoteReferenceNode extends DecoratorNode<ReactElement> {
  __footnoteId: string;

  constructor(footnoteId: string, key?: NodeKey) {
    super(key);
    this.__footnoteId = footnoteId;
  }

  static getType(): string {
    return 'footnote-reference';
  }

  static clone(node: FootnoteReferenceNode): FootnoteReferenceNode {
    return new FootnoteReferenceNode(node.__footnoteId, node.__key);
  }

  getFootnoteId(): string {
    return this.getLatest().__footnoteId;
  }

  static importJSON(serializedNode: SerializedFootnoteReferenceNode): FootnoteReferenceNode {
    return $createFootnoteReferenceNode(serializedNode.footnoteId);
  }

  exportJSON(): SerializedFootnoteReferenceNode {
    return { type: 'footnote-reference', version: 1, footnoteId: this.getFootnoteId() };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      sup: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        const id = domNode.getAttribute('data-likhari-footnote-ref');
        if (!id) return null;
        return { conversion: () => ({ node: $createFootnoteReferenceNode(id) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('sup');
    element.setAttribute('data-likhari-footnote-ref', this.getFootnoteId());
    const anchor = document.createElement('a');
    anchor.setAttribute('href', `#fn-${this.getFootnoteId()}`);
    anchor.setAttribute('id', `fnref-${this.getFootnoteId()}`);
    element.appendChild(anchor);
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('sup');
    addClassNamesToElement(element, config.theme.footnoteReference ?? 'likhari-footnote-ref');
    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  getTextContent(): string {
    return `[^${this.getFootnoteId()}]`;
  }

  isInline(): true {
    return true;
  }

  decorate(): ReactElement {
    // The bracketed number itself is a CSS ::after counter (editor.css) —
    // nothing to render here but the counted element.
    return <></>;
  }
}

export function $createFootnoteReferenceNode(footnoteId: string): FootnoteReferenceNode {
  return $applyNodeReplacement(new FootnoteReferenceNode(footnoteId));
}

export function $isFootnoteReferenceNode(node: LexicalNode | null | undefined): node is FootnoteReferenceNode {
  return node instanceof FootnoteReferenceNode;
}

/** Resolves a reference's footnoteId from the editor state just before its
 * deletion committed — a mutation listener's 'destroyed' entries only carry
 * the NodeKey, and by the time the listener fires the *current* state no
 * longer has the node, so the caller must pass the listener's own
 * `prevEditorState` here to know which FootnoteItemNode to clean up. */
export function $getFootnoteIdByKey(prevEditorState: EditorState, key: NodeKey): string | null {
  let id: string | null = null;
  prevEditorState.read(() => {
    const node = $getNodeByKey(key);
    if ($isFootnoteReferenceNode(node)) id = node.getFootnoteId();
  });
  return id;
}
