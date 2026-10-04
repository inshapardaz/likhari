import { $createRangeSelection, $getRoot, $getSelection, $isRangeSelection, $setSelection, type TextNode } from 'lexical';

/** A match as a Lexical selection range: start and end points, each in a text node. */
export interface FindMatch {
  anchorKey: string;
  anchorOffset: number;
  focusKey: string;
  focusOffset: number;
}

/**
 * Text nodes grouped by their parent, in document order. A match is searched
 * for within one parent only, so it never spans two paragraphs or table
 * cells, but it can span the several text nodes that formatting splits a
 * paragraph into.
 */
export function $textGroups(): TextNode[][] {
  const groups = new Map<string, TextNode[]>();
  for (const node of $getRoot().getAllTextNodes()) {
    const parentKey = node.getParentOrThrow().getKey();
    const group = groups.get(parentKey);
    if (group) group.push(node);
    else groups.set(parentKey, [node]);
  }
  return [...groups.values()];
}

/** The text node and offset that a character index in a group falls in. */
export function $locate(group: TextNode[], index: number, end: boolean): { key: string; offset: number } {
  let start = 0;
  for (const node of group) {
    const length = node.getTextContent().length;
    const inside = end ? index > start && index <= start + length : index >= start && index < start + length;
    if (inside) return { key: node.getKey(), offset: index - start };
    start += length;
  }
  const last = group[group.length - 1];
  return { key: last.getKey(), offset: last.getTextContent().length };
}

/** Every non-overlapping occurrence of `query` in the document, case-sensitive. */
export function $findMatches(query: string): FindMatch[] {
  if (query === '') return [];
  const matches: FindMatch[] = [];
  for (const group of $textGroups()) {
    const text = group.map((node) => node.getTextContent()).join('');
    let index = text.indexOf(query);
    while (index !== -1) {
      const start = $locate(group, index, false);
      const end = $locate(group, index + query.length, true);
      matches.push({ anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset });
      index = text.indexOf(query, index + query.length);
    }
  }
  return matches;
}

/** Makes the match the editor's selection, so it's highlighted and scrolled to. */
export function $selectMatch(match: FindMatch): void {
  const selection = $createRangeSelection();
  selection.anchor.set(match.anchorKey, match.anchorOffset, 'text');
  selection.focus.set(match.focusKey, match.focusOffset, 'text');
  $setSelection(selection);
}

/**
 * Replaces one match, keeping the formatting of the text around it. The
 * replacement takes the formatting of the match's first character.
 */
export function $replaceMatch(match: FindMatch, replacement: string): void {
  $selectMatch(match);
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;
  if (replacement === '') selection.removeText();
  else selection.insertText(replacement);
}

/**
 * Replaces every match. Walks from the last match to the first, so each
 * replacement leaves the positions of the matches before it unchanged.
 * Returns how many were replaced.
 */
export function $replaceAll(query: string, replacement: string): number {
  const matches = $findMatches(query);
  for (let i = matches.length - 1; i >= 0; i--) $replaceMatch(matches[i], replacement);
  return matches.length;
}
