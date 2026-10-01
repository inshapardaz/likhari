import {
  $applyNodeReplacement,
  $createParagraphNode,
  type DOMConversion,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalCommand,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
  createCommand,
  ElementNode,
} from 'lexical';
import { addClassNamesToElement } from '@lexical/utils';

/** Payload: how many (equal-width) columns to create. Ratio support beyond
 * equal widths is deferred (lexical-editor-spec.md §4.9 mentions it as a
 * "configurable" possibility, not a committed requirement for Phase 3). */
export const INSERT_LAYOUT_COMMAND: LexicalCommand<{ columnCount: number }> = createCommand('INSERT_LAYOUT_COMMAND');

export type SerializedLayoutContainerNode = Spread<{ templateColumns: string }, SerializedElementNode>;
export type SerializedLayoutItemNode = SerializedElementNode;

/** A multi-column row (editor-architecture-design.md §3.2): an ElementNode
 * holding one LayoutItemNode per column, laid out with CSS grid. Reused as
 * the structural basis for two-column poetry layouts (spec §4.11). */
export class LayoutContainerNode extends ElementNode {
  __templateColumns: string;

  constructor(templateColumns = 'repeat(2, 1fr)', key?: NodeKey) {
    super(key);
    this.__templateColumns = templateColumns;
  }

  static getType(): string {
    return 'layout-container';
  }

  static clone(node: LayoutContainerNode): LayoutContainerNode {
    return new LayoutContainerNode(node.__templateColumns, node.__key);
  }

  getTemplateColumns(): string {
    return this.getLatest().__templateColumns;
  }

  setTemplateColumns(templateColumns: string): this {
    const writable = this.getWritable();
    writable.__templateColumns = templateColumns;
    return writable;
  }

  static importJSON(serializedNode: SerializedLayoutContainerNode): LayoutContainerNode {
    return $createLayoutContainerNode(serializedNode.templateColumns);
  }

  exportJSON(): SerializedLayoutContainerNode {
    return { ...super.exportJSON(), type: 'layout-container', version: 1, templateColumns: this.getTemplateColumns() };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        if (!domNode.hasAttribute('data-likhari-layout-container')) return null;
        const templateColumns = domNode.style.gridTemplateColumns || undefined;
        return { conversion: () => ({ node: $createLayoutContainerNode(templateColumns) }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-layout-container', '');
    element.style.display = 'grid';
    element.style.gridTemplateColumns = this.getTemplateColumns();
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.layoutContainer ?? 'likhari-layout-container');
    element.style.gridTemplateColumns = this.__templateColumns;
    return element;
  }

  updateDOM(prevNode: LayoutContainerNode, dom: HTMLElement): boolean {
    if (prevNode.__templateColumns !== this.__templateColumns) {
      dom.style.gridTemplateColumns = this.__templateColumns;
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

export function $createLayoutContainerNode(templateColumns = 'repeat(2, 1fr)'): LayoutContainerNode {
  return $applyNodeReplacement(new LayoutContainerNode(templateColumns));
}

export function $isLayoutContainerNode(node: LexicalNode | null | undefined): node is LayoutContainerNode {
  return node instanceof LayoutContainerNode;
}

/** One column's content area inside a LayoutContainerNode. Always keeps at
 * least an empty paragraph (mirrors TableCellNode), so a column can never
 * collapse to an unselectable, unfocusable void. */
export class LayoutItemNode extends ElementNode {
  static getType(): string {
    return 'layout-item';
  }

  static clone(node: LayoutItemNode): LayoutItemNode {
    return new LayoutItemNode(node.__key);
  }

  static importJSON(): LayoutItemNode {
    return $createLayoutItemNode();
  }

  exportJSON(): SerializedLayoutItemNode {
    return { ...super.exportJSON(), type: 'layout-item', version: 1 };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion<HTMLElement> | null => {
        if (!domNode.hasAttribute('data-likhari-layout-item')) return null;
        return { conversion: () => ({ node: $createLayoutItemNode() }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-layout-item', '');
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.layoutItem ?? 'likhari-layout-item');
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

export function $createLayoutItemNode(): LayoutItemNode {
  return $applyNodeReplacement(new LayoutItemNode());
}

export function $isLayoutItemNode(node: LexicalNode | null | undefined): node is LayoutItemNode {
  return node instanceof LayoutItemNode;
}

/** Builds a container with `columnCount` empty items — the shape every
 * LAYOUT insert produces, and what the node-transform below re-normalizes
 * a malformed tree back toward. */
export function $createLayoutWithColumns(columnCount: number): LayoutContainerNode {
  const count = Math.max(2, Math.min(6, Math.round(columnCount)));
  const container = $createLayoutContainerNode(`repeat(${count}, 1fr)`);
  for (let i = 0; i < count; i++) {
    container.append($createLayoutItemNode().append($createParagraphNode()));
  }
  return container;
}
