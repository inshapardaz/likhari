import { describe, expect, it } from 'vitest';
import { apiCompletionStore } from './completionStores';

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
});
