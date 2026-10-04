import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
} from 'lexical';
import { $locate, $replaceMatch, $textGroups } from '../find/findReplaceActions';
import { wordsIn } from '../spellcheck/spellDictionaries';
import type { PunctuationRule } from './punctuationRules';

/** The part of a word that counts as word characters at its end. */
const WORD_END = /[\p{L}\p{M}'’]+$/u;
const WORD_CHAR = /[\p{L}\p{M}'’]/u;

/**
 * Corrects the word that ends just before the caret, when the character just
 * typed (the word boundary: space or punctuation) is not a word character. The
 * correction replaces only the word, and the caret stays right after the
 * boundary. Returns true if a correction was made.
 */
export function $correctWordBeforeCaret(table: Map<string, string>, normalize?: (word: string) => string): boolean {
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
  const replacement = correctionFor(word, table, normalize);
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
export function $correctDocument(
  ltr: Map<string, string>,
  rtl: Map<string, string>,
  normalizeRtl?: (text: string) => string,
): number {
  if (normalizeRtl) {
    for (const node of $getRoot().getAllTextNodes()) {
      if (node.getParentOrThrow().getDirection() !== 'rtl') continue;
      const text = node.getTextContent();
      const normalized = normalizeRtl(text);
      if (normalized !== text) node.setTextContent(normalized);
    }
  }

  let corrected = 0;
  for (const group of $textGroups()) {
    const rightToLeft = group[0].getParentOrThrow().getDirection() === 'rtl';
    const table = rightToLeft ? rtl : ltr;
    const text = group.map((node) => node.getTextContent()).join('');
    const spans = wordsIn(text)
      .map((span) => ({ span, replacement: correctionFor(span.word, table, rightToLeft ? normalizeRtl : undefined) }))
      .filter((item) => item.replacement !== undefined && item.replacement !== item.span.word);
    // Right to left, so earlier positions stay valid as each word is replaced.
    for (const { span, replacement } of spans.reverse()) {
      const start = $locate(group, span.start, false);
      const end = $locate(group, span.end, true);
      $replaceMatch(
        { anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset },
        replacement!,
      );
      corrected += 1;
    }
  }
  return corrected;
}

/** What a word should become: its normalised form, then any table correction for that. */
function correctionFor(word: string, table: Map<string, string>, normalize?: (word: string) => string): string | undefined {
  const normalized = normalize ? normalize(word) : word;
  return table.get(normalized) ?? (normalized !== word ? normalized : undefined);
}

/**
 * Applies a punctuation rule to the text just before the caret, when that text
 * ends with a rule's incorrect form. Longest match first. The caret ends after
 * the replacement.
 */
export function $correctPunctuationBeforeCaret(rules: PunctuationRule[]): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const anchor = selection.anchor;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return false;

  const before = node.getTextContent().slice(0, anchor.offset);
  const rule = rules.find((r) => before.endsWith(r.incorrect) && (!r.completeWord || !WORD_CHAR.test(before.charAt(before.length - r.incorrect.length - 1) || ' ')));
  if (!rule) return false;

  const start = before.length - rule.incorrect.length;
  $replaceMatch({ anchorKey: node.getKey(), anchorOffset: start, focusKey: node.getKey(), focusOffset: before.length }, rule.correct);
  const after = $getSelection();
  if ($isRangeSelection(after)) {
    const caret = start + rule.correct.length;
    after.anchor.set(node.getKey(), caret, 'text');
    after.focus.set(node.getKey(), caret, 'text');
  }
  return true;
}

/**
 * Applies the punctuation rules to every paragraph and cell in the document.
 * Where two matches overlap, the longer one wins. Returns how many were applied.
 */
export function $correctPunctuationDocument(rules: PunctuationRule[]): number {
  let applied = 0;
  for (const group of $textGroups()) {
    const text = group.map((node) => node.getTextContent()).join('');
    const candidates: { start: number; end: number; correct: string }[] = [];
    for (const rule of rules) {
      let index = text.indexOf(rule.incorrect);
      while (index !== -1) {
        candidates.push({ start: index, end: index + rule.incorrect.length, correct: rule.correct });
        index = text.indexOf(rule.incorrect, index + 1);
      }
    }
    // Longest first, then earliest; keep only matches that do not overlap a kept one.
    candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
    const kept: typeof candidates = [];
    for (const c of candidates) {
      if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
    }
    // Right to left, so earlier positions stay valid as each match is replaced.
    for (const c of kept.sort((a, b) => b.start - a.start)) {
      const start = $locate(group, c.start, false);
      const end = $locate(group, c.end, true);
      $replaceMatch({ anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset }, c.correct);
      applied += 1;
    }
  }
  return applied;
}

type SavedPoint = { key: string; offset: number; type: 'text' | 'element' };

/**
 * Runs `change` and then puts the caret back where it was. Replacements move the
 * selection onto each match they make, so a whole-document pass would otherwise
 * leave the caret at the last match, or at the end of the document.
 */
export function $preservingSelection(change: () => void): void {
  const before = $getSelection();
  const saved = $isRangeSelection(before)
    ? {
        anchor: { key: before.anchor.key, offset: before.anchor.offset, type: before.anchor.type } as SavedPoint,
        focus: { key: before.focus.key, offset: before.focus.offset, type: before.focus.type } as SavedPoint,
      }
    : null;

  change();

  if (!saved) {
    $setSelection(null);
    return;
  }
  if (!$getNodeByKey(saved.anchor.key) || !$getNodeByKey(saved.focus.key)) return;
  const selection = $createRangeSelection();
  selection.anchor.set(saved.anchor.key, saved.anchor.offset, saved.anchor.type);
  selection.focus.set(saved.focus.key, saved.focus.offset, saved.focus.type);
  $setSelection(selection);
}
