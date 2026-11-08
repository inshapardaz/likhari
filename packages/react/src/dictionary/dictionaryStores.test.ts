import { describe, expect, it } from 'vitest';
import { apiDictionaryStore, freeDictionaryApiStore } from './dictionaryStores';

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
