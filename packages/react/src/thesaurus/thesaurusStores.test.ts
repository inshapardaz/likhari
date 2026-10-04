import { describe, expect, it } from 'vitest';
import { apiThesaurusStore, lookupSynonyms, parseWordNetData, parseWordNetIndex, wordNetThesaurusStore } from './thesaurusStores';

// Lines copied from WordNet 3.1 (index.noun and data.noun).
const INDEX = [
  '  1 This software and database is being provided to you, the LICENSEE, by',
  'cat n 8 5 @ ~ #m + ; 8 1 02124272 10172934 09919605 03614083 02989061 02986962 02130460 00903174',
].join('\n');
const DATA = [
  '  1 This software and database is being provided to you, the LICENSEE, by',
  '02124272 05 n 02 cat 0 true_cat 0 003 @ 02123649 n 0000 ~ 02124460 n 0000 ~ 02127275 n 0000 | feline mammal usually having thick soft fur and no ability to roar: domestic cats; wildcats',
].join('\n');

describe('WordNet parsing', () => {
  it('reads the synsets a lemma belongs to', () => {
    const index = parseWordNetIndex(INDEX, 'noun');
    expect(index.get('cat')).toEqual([
      { pos: 'noun', offsets: ['02124272', '10172934', '09919605', '03614083', '02989061', '02986962', '02130460', '00903174'] },
    ]);
  });

  it('reads the words in each synset, with underscores as spaces and without the gloss', () => {
    const synsets = parseWordNetData(DATA);
    expect(synsets.get('02124272')).toEqual(['cat', 'true cat']);
  });
});

describe('thesaurus stores', () => {
  it('merges synonyms from several stores, in order, without the word itself or repeats', async () => {
    const first = { id: 'a', lookup: async () => ['feline', 'cat'] };
    const second = { id: 'b', lookup: async () => ['feline', 'true cat', 'moggy'] };
    expect(await lookupSynonyms([first, second], 'cat', 'en')).toEqual(['feline', 'true cat', 'moggy']);
  });

  it('skips a store that fails', async () => {
    const down = {
      id: 'down',
      lookup: async (): Promise<string[]> => {
        throw new Error('offline');
      },
    };
    expect(await lookupSynonyms([down, { id: 'ok', lookup: async () => ['moggy'] }], 'cat', 'en')).toEqual(['moggy']);
  });

  it('reads synonyms from an API', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify(['moggy', 7]))) as typeof fetch;
    const store = apiThesaurusStore({ url: 'https://api.example/synonyms', fetch: fakeFetch });
    expect(await store.lookup('cat', 'en')).toEqual(['moggy']);
  });

  it('gives no WordNet synonyms for languages it does not cover', async () => {
    expect(await wordNetThesaurusStore().lookup('کتاب', 'ur')).toEqual([]);
  });
});
