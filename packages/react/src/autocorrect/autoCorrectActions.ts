import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import { $replaceMatch } from '../find/findReplaceActions';

/** The part of a word that counts as word characters at its end. */
const WORD_END = /[\p{L}\p{M}'’]+$/u;
const WORD_CHAR = /[\p{L}\p{M}'’]/u;

/**
 * Corrects the word that ends just before the caret, when the character just
 * typed (the word boundary: space or punctuation) is not a word character. The
 * correction replaces only the word, and the caret stays right after the
 * boundary. Returns true if a correction was made.
 */
export function $correctWordBeforeCaret(table: Map<string, string>): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const anchor = selection.anchor;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return false;

  const before = node.getTextContent().slice(0, anchor.offset);
  const boundary = before.slice(-1);
  if (boundary === '' || WORD_CHAR.test(boundary)) return false;

  const body = before.slice(0, -1);
  const word = WORD_END.exec(body)?.[0];
  if (!word) return false;
  const replacement = table.get(word);
  if (replacement === undefined || replacement === word) return false;

  const start = body.length - word.length;
  $replaceMatch(
    { anchorKey: node.getKey(), anchorOffset: start, focusKey: node.getKey(), focusOffset: body.length },
    replacement,
  );

  // Put the caret back after the boundary the user typed, not at the end of the replacement.
  const after = $getSelection();
  if ($isRangeSelection(after)) {
    const focusNode = after.focus.getNode();
    const caret = after.focus.offset + boundary.length;
    after.anchor.set(focusNode.getKey(), caret, 'text');
    after.focus.set(focusNode.getKey(), caret, 'text');
  }
  return true;
}
