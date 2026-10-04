import { $getNearestNodeFromDOMNode, $isTextNode } from 'lexical';
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

/** The whole word around an offset in a Lexical text node. Must run inside an editor read or update. */
export function $wordAtDomPoint(domText: Node, offset: number): WordAtPoint | null {
  const node = $getNearestNodeFromDOMNode(domText);
  if (!$isTextNode(node)) return null;
  const text = node.getTextContent();
  const span = wordsIn(text).find((s) => offset >= s.start && offset <= s.end);
  if (!span) return null;
  return {
    word: span.word,
    direction: node.getParentOrThrow().getDirection() === 'rtl' ? 'rtl' : 'ltr',
    match: { anchorKey: node.getKey(), anchorOffset: span.start, focusKey: node.getKey(), focusOffset: span.end },
  };
}
