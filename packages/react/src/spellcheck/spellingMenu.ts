import { $getNearestNodeFromDOMNode, $getSelection, $isRangeSelection, $isTextNode, type TextNode } from 'lexical';
import type { FindMatch } from '../find/findReplaceActions';
import { wordsIn } from './spellDictionaries';

/** A word under the pointer, as a Lexical range, with the direction of its block. */
export interface WordAtPoint {
  word: string;
  direction: 'ltr' | 'rtl';
  match: FindMatch;
}

/** The DOM text node and offset under a viewport point, or null if the point is not on text. */
export function textPointAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    return position && position.offsetNode.nodeType === Node.TEXT_NODE ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = doc.caretRangeFromPoint?.(x, y);
  return range && range.startContainer.nodeType === Node.TEXT_NODE ? { node: range.startContainer, offset: range.startOffset } : null;
}

/** The whole word around an offset in a Lexical text node. */
function $wordAtTextOffset(node: TextNode, offset: number): WordAtPoint | null {
  const text = node.getTextContent();
  const span = wordsIn(text).find((s) => offset >= s.start && offset <= s.end);
  if (!span) return null;
  return {
    word: span.word,
    direction: node.getParentOrThrow().getDirection() === 'rtl' ? 'rtl' : 'ltr',
    match: { anchorKey: node.getKey(), anchorOffset: span.start, focusKey: node.getKey(), focusOffset: span.end },
  };
}

/** The whole word around an offset in a Lexical text node. Must run inside an editor read or update. */
export function $wordAtDomPoint(domText: Node, offset: number): WordAtPoint | null {
  const node = $getNearestNodeFromDOMNode(domText);
  if (!$isTextNode(node)) return null;
  return $wordAtTextOffset(node, offset);
}

/** The whole word at the caret, for keyboard shortcuts that act on "the word here"
 * without a mouse position. Must run inside an editor read or update. */
export function $wordAtSelection(): WordAtPoint | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const node = selection.anchor.getNode();
  if (!$isTextNode(node)) return null;
  return $wordAtTextOffset(node, selection.anchor.offset);
}

/** Whether the current selection is no wider than `word` — a caret, or a selection that
 * sits entirely inside that one word. A selection that reaches beyond it (more of that
 * word's line, another word, another line) means the user selected something other than
 * just this word, even though it happens to be the word under the pointer. Must run
 * inside an editor read or update. */
export function $selectionIsWithinWord(word: WordAtPoint): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return true;
  const { anchorKey, anchorOffset, focusKey, focusOffset } = word.match;
  const withinSpan = (key: string, offset: number) => key === anchorKey && offset >= anchorOffset && offset <= focusOffset;
  return withinSpan(selection.anchor.key, selection.anchor.offset) && withinSpan(selection.focus.key, selection.focus.offset);
}
