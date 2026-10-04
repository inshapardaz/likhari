import { describe, expect, it } from 'vitest';
import { apiCompletionStore, dictionaryCompletionStore } from './completionStores';

describe('completion stores', () => {
  it('loads completion words from an API for the language', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify(['cabinet', 42, 'cabin']));
    }) as typeof fetch;
    const store = apiCompletionStore({ url: 'https://api.example/words', fetch: fakeFetch });
    expect(await store.load('en')).toEqual(['cabinet', 'cabin']);
    expect(calls[0]).toBe('https://api.example/words?language=en');
  });

  it('counts accepted completions and reads the counts back', async () => {
    const data = new Map<string, string>();
    const saved = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    try {
      const store = dictionaryCompletionStore();
      await store.recordAccept!('en', 'cabinet');
      await store.recordAccept!('en', 'cabinet');
      expect(await store.loadCounts!('en')).toEqual({ cabinet: 2 });
      expect(await store.loadCounts!('ur')).toEqual({});
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = saved;
    }
  });
});
