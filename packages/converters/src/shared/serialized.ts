import type { SerializedEditorState } from 'lexical';

/**
 * Loose structural view of Lexical's serialized nodes. Converters work on
 * plain JSON so they stay free of the editor, the DOM-bound node classes and
 * React (architecture doc §1).
 */
export interface SNode {
  type: string;
  version?: number;
  children?: SNode[];
  [key: string]: unknown;
}

export const FORMAT_BOLD = 1;
export const FORMAT_ITALIC = 2;
export const FORMAT_STRIKETHROUGH = 4;
export const FORMAT_UNDERLINE = 8;
export const FORMAT_CODE = 16;
export const FORMAT_SUBSCRIPT = 32;
export const FORMAT_SUPERSCRIPT = 64;
export const FORMAT_HIGHLIGHT = 128;

/** Pixels Lexical's own DOM export uses per indent level. */
export const INDENT_PX = 40;

export type Direction = 'ltr' | 'rtl' | null;

export function rootChildren(state: SerializedEditorState): SNode[] {
  return ((state.root as unknown as SNode).children ?? []) as SNode[];
}

export function textNode(text: string, format = 0, style = ''): SNode {
  return { type: 'text', text, detail: 0, format, mode: 'normal', style, version: 1 };
}

export function elementBase(type: string, children: SNode[], extra: Record<string, unknown> = {}): SNode {
  return { type, children, direction: null, format: '', indent: 0, version: 1, ...extra };
}

export function paragraph(children: SNode[] = [], extra: Record<string, unknown> = {}): SNode {
  return elementBase('paragraph', children, { textFormat: 0, textStyle: '', ...extra });
}

export function makeState(blocks: SNode[]): SerializedEditorState {
  const children = blocks.length > 0 ? blocks : [paragraph()];
  return {
    root: { type: 'root', children, direction: null, format: '', indent: 0, version: 1 },
  } as unknown as SerializedEditorState;
}

/** Inline node types: everything else is a block. */
export function isInlineNode(node: SNode): boolean {
  return node.type === 'text' || node.type === 'linebreak' || node.type === 'tab' || node.type === 'link' || node.type === 'autolink';
}

/** Footnote reference numbers (lexical-editor-spec.md §4.10) are never
 * stored — they're each `footnote-reference` node's position, in document
 * order, among all such nodes. Walks the whole tree once so every converter
 * numbers references and their matching footnote-list entries identically. */
export function collectFootnoteOrder(blocks: SNode[]): Map<string, number> {
  const order = new Map<string, number>();
  const visit = (node: SNode) => {
    if (node.type === 'footnote-reference' && typeof node.footnoteId === 'string' && !order.has(node.footnoteId)) {
      order.set(node.footnoteId, order.size + 1);
    }
    (node.children ?? []).forEach(visit);
  };
  blocks.forEach(visit);
  return order;
}
