import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSpeller, registerSpellDictionary } from './spellDictionaries';
import { addUserWord, ignoreWord, isAcceptedWord, localStorageUserWordStore, loadUserWords, restoreIgnoredWords } from './userWords';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('spelling ignore and user dictionary', () => {
  let saved: { local?: unknown; session?: unknown };
  beforeEach(() => {
    const g = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
    saved = { local: g.localStorage, session: g.sessionStorage };
    g.localStorage = fakeStorage();
    g.sessionStorage = fakeStorage();
  });
  afterEach(() => {
    const g = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
    g.localStorage = saved.local;
    g.sessionStorage = saved.session;
  });

  it('ignores a word for the session, and keeps it in session storage', () => {
    ignoreWord('en', 'zorbak');
    expect(isAcceptedWord('en', 'zorbak')).toBe(true);
    expect(isAcceptedWord('ur', 'zorbak')).toBe(false);
    expect(JSON.parse(sessionStorage.getItem('likhari-spell-ignore')!)).toContainEqual({ language: 'en', word: 'zorbak' });
  });

  it('restores ignored words from session storage', () => {
    sessionStorage.setItem('likhari-spell-ignore', JSON.stringify([{ language: 'en', word: 'plorn' }]));
    restoreIgnoredWords();
    expect(isAcceptedWord('en', 'plorn')).toBe(true);
  });

  it('adds a word to the first writable store and treats it as correct', async () => {
    const store = localStorageUserWordStore();
    expect(await addUserWord([store], 'en', 'quimble')).toBe(true);
    expect(isAcceptedWord('en', 'quimble')).toBe(true);
    expect(await store.load('en')).toContain('quimble');
  });

  it('loads a user dictionary from the stores', async () => {
    const store = localStorageUserWordStore();
    await store.append!('ur', 'نیا');
    await loadUserWords([store]);
    expect(isAcceptedWord('ur', 'نیا')).toBe(true);
  });

  it('makes the speller accept ignored and added words', async () => {
    registerSpellDictionary('en', { aff: 'SET UTF-8\n', dic: '1\nhello\n' });
    const speller = await getSpeller('en')!;
    expect(speller.correct('hello')).toBe(true);
    expect(speller.correct('frobnic')).toBe(false);
    ignoreWord('en', 'frobnic');
    expect(speller.correct('frobnic')).toBe(true);
  });
});
