import { describe, expect, it } from 'vitest';
import { apiDictionaryStore, freeDictionaryApiStore, listNawishtaDictionaryStores, nawishtaDictionaryStore } from './dictionaryStores';

describe('dictionary stores', () => {
  it('parses a dictionaryapi.dev response into one entry per meaning', async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify([
          {
            word: 'hello',
            meanings: [
              { partOfSpeech: 'noun', definitions: [{ definition: 'A greeting.' }] },
              { partOfSpeech: 'verb', definitions: [{ definition: 'To greet.' }, { definition: 'To say hello.' }] },
            ],
          },
        ]),
      )) as typeof fetch;
    const store = freeDictionaryApiStore({ fetch: fakeFetch });
    expect(await store.lookup('hello', 'en')).toEqual({
      word: 'hello',
      meanings: ['noun: A greeting.', 'verb: To greet.', 'verb: To say hello.'],
    });
  });

  it('returns null for a 404 (no entry)', async () => {
    const fakeFetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const store = freeDictionaryApiStore({ fetch: fakeFetch });
    expect(await store.lookup('zzzznotaword', 'en')).toBeNull();
  });

  it('covers only English', async () => {
    const fakeFetch = (async () => {
      throw new Error('should not be called');
    }) as typeof fetch;
    const store = freeDictionaryApiStore({ fetch: fakeFetch });
    expect(await store.lookup('کتاب', 'ur')).toBeNull();
  });

  it('reads an entry from a host API, with the word and language in the query', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ word: 'cat', meanings: ['a small domesticated feline'] }));
    }) as typeof fetch;
    const store = apiDictionaryStore({ label: 'My dictionary', url: 'https://api.example/dictionary', fetch: fakeFetch });
    expect(await store.lookup('cat', 'en')).toEqual({ word: 'cat', meanings: ['a small domesticated feline'] });
    expect(calls).toEqual(['https://api.example/dictionary?word=cat&language=en']);
  });

  it('returns null for a host API 404', async () => {
    const fakeFetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const store = apiDictionaryStore({ label: 'My dictionary', url: 'https://api.example/dictionary', fetch: fakeFetch });
    expect(await store.lookup('zzz', 'en')).toBeNull();
  });
});

describe('nawishta dictionary stores', () => {
  const article = (headword: string, ...definitions: string[]) => ({
    headword,
    senses: [{ meanings: definitions.map((definition) => ({ definition })) }],
  });

  it('keeps only the articles whose headword is the word, ignoring diacritics and spacing', async () => {
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ data: [article('آسمانی کتاب', 'x'), article(' کِتاب ', 'one', 'two'), article('کتاب', 'three')] }));
    }) as unknown as typeof fetch;
    const store = nawishtaDictionaryStore({ dictionaryId: 3, label: 'اردو لغت', fetch: fakeFetch });
    expect(store.id).toBe('nawishta-3');
    expect(await store.lookup('کتاب', 'ur')).toEqual({ word: 'کِتاب', meanings: ['one', 'two', 'three'] });
    expect(urls[0]).toBe(`https://api.nawishta.co.uk/dictionaries/3/articles?query=${encodeURIComponent('کتاب')}&pageSize=200`);
  });

  it('returns null with no exact headword, and never queries for English', async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ data: [article('آسمانی کتاب', 'x')] }));
    }) as unknown as typeof fetch;
    const store = nawishtaDictionaryStore({ dictionaryId: 3, label: 'x', fetch: fakeFetch });
    expect(await store.lookup('کتاب', 'ur')).toBeNull();
    expect(await store.lookup('book', 'en')).toBeNull();
    expect(calls).toBe(1);
  });

  it('lists the library dictionaries as stores named after them', async () => {
    const fakeFetch = (async (url: string) =>
      new Response(
        url.endsWith('/dictionaries?pageSize=100')
          ? JSON.stringify({ data: [{ id: 3, name: 'اردو لغت' }, { id: 2, name: 'فرہنگ آصفیہ' }, { name: 'broken' }] })
          : JSON.stringify({ data: [article('لفظ', 'meaning')] }),
      )) as unknown as typeof fetch;
    const stores = await listNawishtaDictionaryStores({ baseUrl: 'https://example.test/', fetch: fakeFetch });
    expect(stores.map((s) => [s.id, s.label])).toEqual([
      ['nawishta-3', 'اردو لغت'],
      ['nawishta-2', 'فرہنگ آصفیہ'],
    ]);
    expect(await stores[0].lookup('لفظ', 'ur')).toEqual({ word: 'لفظ', meanings: ['meaning'] });
  });
});
