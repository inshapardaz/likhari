import type { SpellLanguage } from './spellDictionaries';

/**
 * Where words the user has added to the dictionary are kept. Like the
 * auto-correct stores: the host can pass several, and words are added to the
 * first one that accepts writes.
 */
export interface UserWordStore {
  readonly id: string;
  readonly readOnly?: boolean;
  load(language: SpellLanguage): Promise<string[]>;
  append?(language: SpellLanguage, word: string): Promise<void>;
}

const LOCAL_KEY = 'likhari-user-words';
const SESSION_KEY = 'likhari-spell-ignore';
const LANGUAGES: SpellLanguage[] = ['en', 'ur', 'pa-shahmukhi'];

interface StoredWord {
  language: SpellLanguage;
  word: string;
}

function readStored(key: string): StoredWord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? (parsed as StoredWord[]).filter((e) => typeof e?.word === 'string') : [];
  } catch {
    return [];
  }
}

/** Words added to the dictionary, kept in this browser's localStorage. */
export function localStorageUserWordStore(options: { key?: string } = {}): UserWordStore {
  const key = options.key ?? LOCAL_KEY;
  return {
    id: 'local-storage',
    async load(language) {
      return readStored(key)
        .filter((e) => e.language === language)
        .map((e) => e.word);
    },
    async append(language, word) {
      const all = readStored(key);
      if (all.some((e) => e.language === language && e.word === word)) return;
      all.push({ language, word });
      try {
        localStorage.setItem(key, JSON.stringify(all));
      } catch {
        // Storage full or disabled: the word stays for this session only.
      }
    },
  };
}

/**
 * Words served by an API. `load` calls `GET {url}?language=xx` and expects a JSON
 * array of strings; `append` calls `POST {url}` with `{ language, word }`.
 */
export function apiUserWordStore(options: {
  id?: string;
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): UserWordStore {
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'api',
    async load(language) {
      const response = await doFetch(`${options.url}?language=${encodeURIComponent(language)}`, { headers: options.headers });
      if (!response.ok) throw new Error(`User word API failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? data.filter((w): w is string => typeof w === 'string') : [];
    },
    async append(language, word) {
      const response = await doFetch(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: JSON.stringify({ language, word }),
      });
      if (!response.ok) throw new Error(`User word API rejected the word: ${response.status}`);
    },
  };
}

// Words the user accepted (kept in their store), and words ignored for this session.
const accepted = new Map<SpellLanguage, Set<string>>(LANGUAGES.map((l) => [l, new Set<string>()]));
const ignored = new Map<SpellLanguage, Set<string>>(LANGUAGES.map((l) => [l, new Set<string>()]));
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** The words the user has added to the dictionary for a language. */
export function acceptedWords(language: SpellLanguage): string[] {
  return [...(accepted.get(language) ?? [])];
}

/** Calls `listener` whenever accepted or ignored words change. Returns an unsubscribe function. */
export function onSpellWordsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the speller should treat the word as correct: it is in the user's dictionary or ignored this session. */
export function isAcceptedWord(language: SpellLanguage, word: string): boolean {
  return accepted.get(language)?.has(word) === true || ignored.get(language)?.has(word) === true;
}

/** Loads the user's words for each language from the stores (in order). */
export async function loadUserWords(stores: UserWordStore[]): Promise<void> {
  for (const language of LANGUAGES) {
    const set = accepted.get(language)!;
    set.clear();
    const results = await Promise.allSettled(stores.map((store) => store.load(language)));
    for (const result of results) if (result.status === 'fulfilled') for (const word of result.value) set.add(word);
  }
  notify();
}

/** Adds a word to the first store that accepts writes. Returns false if none does. */
export async function addUserWord(stores: UserWordStore[], language: SpellLanguage, word: string): Promise<boolean> {
  const writable = stores.find((store) => !store.readOnly && store.append);
  if (!writable?.append) return false;
  await writable.append(language, word);
  accepted.get(language)?.add(word);
  notify();
  return true;
}

function readIgnored(): StoredWord[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as StoredWord[]).filter((e) => typeof e?.word === 'string') : [];
  } catch {
    return [];
  }
}

/** Loads the session's ignored words. Call once at startup. */
export function restoreIgnoredWords(): void {
  for (const { language, word } of readIgnored()) ignored.get(language)?.add(word);
  notify();
}

/** Ignores a word for the rest of this browser session (kept in sessionStorage). */
export function ignoreWord(language: SpellLanguage, word: string): void {
  ignored.get(language)?.add(word);
  const all = readIgnored();
  if (!all.some((e) => e.language === language && e.word === word)) all.push({ language, word });
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(all));
  } catch {
    // Session storage unavailable: the word is ignored until the page reloads.
  }
  notify();
}

restoreIgnoredWords();
