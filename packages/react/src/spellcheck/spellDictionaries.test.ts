import { describe, expect, it } from 'vitest';
import { getSpeller, hasSpellDictionary, misspellingsIn, registerSpellDictionary, wordsIn } from './spellDictionaries';

const AFF = 'SET UTF-8\n';
const DIC = '3\nhello\nworld\nکتاب\n';

describe('spellcheck dictionaries', () => {
  it('reports a language with no registered dictionary as unavailable', () => {
    expect(hasSpellDictionary('pa-shahmukhi')).toBe(false);
    expect(getSpeller('pa-shahmukhi')).toBeNull();
  });

  it('checks words against a registered dictionary', async () => {
    registerSpellDictionary('ur', { aff: AFF, dic: DIC });
    const speller = getSpeller('ur');
    expect(speller).not.toBeNull();
    const checked = await speller!;
    expect(checked.correct('کتاب')).toBe(true);
    expect(checked.correct('غلط')).toBe(false);
  });

  it('finds misspelled words with their positions', async () => {
    registerSpellDictionary('ur', { aff: AFF, dic: DIC });
    const speller = await getSpeller('ur')!;
    const found = misspellingsIn('کتاب غلط', speller);
    expect(found).toEqual([{ word: 'غلط', start: 5, end: 8 }]);
  });

  it('splits text into words, keeping apostrophes inside words', () => {
    expect(wordsIn("don't stop, now").map((w) => w.word)).toEqual(["don't", 'stop', 'now']);
  });

  it('accepts a loader for dictionaries fetched on demand', async () => {
    registerSpellDictionary('en', async () => ({ aff: AFF, dic: DIC }));
    const speller = await getSpeller('en')!;
    expect(speller.correct('hello')).toBe(true);
  });
});
