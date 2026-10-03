import { $textGroups, $locate, type FindMatch } from '../find/findReplaceActions';
import { wordsIn, type Speller } from './spellDictionaries';

export interface Misspelling {
  word: string;
  match: FindMatch;
}

/** Every word in the document the speller does not recognise, with its position. */
export function $collectMisspellings(speller: Speller): Misspelling[] {
  const found: Misspelling[] = [];
  for (const group of $textGroups()) {
    const text = group.map((node) => node.getTextContent()).join('');
    for (const span of wordsIn(text)) {
      if (speller.correct(span.word)) continue;
      const start = $locate(group, span.start, false);
      const end = $locate(group, span.end, true);
      found.push({
        word: span.word,
        match: { anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset },
      });
    }
  }
  return found;
}
