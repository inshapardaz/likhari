import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '@lexical/clipboard';
import { $createFootnoteListNode, $isFootnoteListNode } from '../blocks/FootnoteListNode';
import { newFootnoteId } from '../blocks/footnoteActions';
import { defaultFormatRegistry, detectContentFormat, hasSemanticHtml, type DetectedFormat } from '@inshapardaz/likhari-converters';
import { $getRoot, type LexicalEditor, type LexicalNode, type RangeSelection, type SerializedEditorState, type SerializedLexicalNode } from 'lexical';

interface SNode {
  type: string;
  children?: SNode[];
  footnoteId?: string;
  [key: string]: unknown;
}

/**
 * Decides whether pasted text should be imported through one of the format
 * parsers rather than inserted as it is.
 *
 * - `html` is the clipboard's `text/html` flavour, when there is one. A copy
 *   from a web page or a word processor carries real structure there, and
 *   Lexical's own paste imports it, so such a paste is left alone (`null`). A
 *   code editor's `text/html` is only coloured `div`/`span` wrappers around the
 *   same text: that is not structure, so the text is still inspected.
 * - Text that reads as Lexical JSON, HTML source or Markdown returns that
 *   format; prose returns `null` and goes through the default paste.
 */
export function formatForPastedText(text: string, html?: string | null): DetectedFormat | null {
  if (html && hasSemanticHtml(html)) return null;
  return detectContentFormat(text);
}

function rewriteFootnoteIds(blocks: SNode[], footnoteList: SNode | undefined): void {
  const ids = new Map<string, string>();
  const fresh = (id: string) => {
    let next = ids.get(id);
    if (!next) {
      next = newFootnoteId();
      ids.set(id, next);
    }
    return next;
  };
  const visit = (node: SNode) => {
    if ((node.type === 'footnote-reference' || node.type === 'footnote-item') && typeof node.footnoteId === 'string') {
      node.footnoteId = fresh(node.footnoteId);
    }
    node.children?.forEach(visit);
  };
  blocks.forEach(visit);
  footnoteList?.children?.forEach(visit);
}

/**
 * Inserts a parsed document at `selection`, the way a paste does: its blocks
 * go where the caret is (the first one merging into the current paragraph,
 * as Lexical's own paste does), and its footnotes join the document's
 * footnote list at the end, under fresh ids so they cannot collide with notes
 * the document already has.
 *
 * Returns false, with the document untouched, when the state holds a node
 * type this editor does not register.
 */
export function $insertEditorStateAtSelection(editor: LexicalEditor, state: SerializedEditorState, selection: RangeSelection): boolean {
  const blocks = structuredClone((state.root as unknown as SNode).children ?? []);
  const footnoteList = blocks.find((block) => block.type === 'footnote-list');
  const body = blocks.filter((block) => block !== footnoteList);
  rewriteFootnoteIds(body, footnoteList);

  // Every node is built before anything is inserted, so a failure changes nothing.
  let bodyNodes: LexicalNode[];
  let itemNodes: LexicalNode[];
  try {
    bodyNodes = $generateNodesFromSerializedNodes(body as unknown as SerializedLexicalNode[]);
    itemNodes = $generateNodesFromSerializedNodes((footnoteList?.children ?? []) as unknown as SerializedLexicalNode[]);
  } catch {
    return false;
  }

  if (bodyNodes.length > 0) $insertGeneratedNodes(editor, bodyNodes, selection);

  if (itemNodes.length > 0) {
    const root = $getRoot();
    const lastChild = root.getLastChild();
    const list = $isFootnoteListNode(lastChild) ? lastChild : $createFootnoteListNode();
    if (!$isFootnoteListNode(lastChild)) root.append(list);
    list.append(...itemNodes);
  }
  return true;
}

/**
 * Pastes `text` as rich content when it is Markdown, HTML source or Lexical
 * JSON. Returns false, having changed nothing, when it is plain text or when
 * it does not parse, so the caller falls back to inserting it as text.
 */
export function $pasteTextAsRichContent(editor: LexicalEditor, text: string, selection: RangeSelection, html?: string | null): boolean {
  const format = formatForPastedText(text, html);
  if (!format) return false;
  let state: SerializedEditorState;
  try {
    state = defaultFormatRegistry.parse(format, text);
  } catch {
    return false;
  }
  return $insertEditorStateAtSelection(editor, state, selection);
}
