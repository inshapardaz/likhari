import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import { $locate, $replaceMatch, $textGroups } from '../find/findReplaceActions';
import { wordsIn } from '../spellcheck/spellDictionaries';

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

/**
 * Corrects every whole word in the document, for text that never went through
 * typing (pasted or loaded content). Words are found per paragraph or cell, so a
 * word split by formatting is still one word. Each block uses the table for its
 * direction. Returns how many words were corrected.
 */
export function $correctDocument(ltr: Map<string, string>, rtl: Map<string, string>): number {
  let corrected = 0;
  for (const group of $textGroups()) {
    const table = group[0].getParentOrThrow().getDirection() === 'rtl' ? rtl : ltr;
    const text = group.map((node) => node.getTextContent()).join('');
    const spans = wordsIn(text).filter((span) => table.has(span.word) && table.get(span.word) !== span.word);
    // Right to left, so earlier positions stay valid as each word is replaced.
    for (const span of spans.reverse()) {
      const start = $locate(group, span.start, false);
      const end = $locate(group, span.end, true);
      $replaceMatch(
        { anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset },
        table.get(span.word)!,
      );
      corrected += 1;
    }
  }
  return corrected;
}
