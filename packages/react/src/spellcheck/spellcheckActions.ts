import { $textGroups, $locate, type FindMatch } from '../find/findReplaceActions';
import { wordsIn, type Speller } from './spellDictionaries';

/** The checker for each text direction: English for LTR blocks, Urdu for RTL. */
export interface Checkers {
  ltr?: Speller;
  rtl?: Speller;
}

/** The part of a misspelled word that falls inside one text node. */
export interface Segment {
  key: string;
  start: number;
  end: number;
}

export interface Misspelling {
  word: string;
  match: FindMatch;
  segments: Segment[];
}

/** Every word in the document its block's checker does not recognise. */
export function $collectMisspellings(checkers: Checkers): Misspelling[] {
  const found: Misspelling[] = [];
  for (const group of $textGroups()) {
    const direction = group[0].getParentOrThrow().getDirection();
    const speller = direction === 'rtl' ? checkers.rtl : checkers.ltr;
    if (!speller) continue;
    const text = group.map((node) => node.getTextContent()).join('');
    for (const span of wordsIn(text)) {
      if (speller.correct(span.word)) continue;
      const start = $locate(group, span.start, false);
      const end = $locate(group, span.end, true);
      found.push({
        word: span.word,
        match: { anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset },
        segments: segmentsOf(group, span.start, span.end),
      });
    }
  }
  return found;
}

function segmentsOf(group: ReturnType<typeof $textGroups>[number], start: number, end: number): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;
  for (const node of group) {
    const length = node.getTextContent().length;
    const from = Math.max(start, offset);
    const to = Math.min(end, offset + length);
    if (to > from) segments.push({ key: node.getKey(), start: from - offset, end: to - offset });
    offset += length;
  }
  return segments;
}
