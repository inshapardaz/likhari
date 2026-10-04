import { getDictionaryWords, type SpellLanguage } from '../spellcheck/spellDictionaries';
import { acceptedWords } from '../spellcheck/userWords';

/**
 * Where autocomplete words come from, and how often each was accepted. The host
 * can pass several; words are combined per language and their counts summed.
 * A failing store is skipped.
 */
export interface CompletionStore {
  readonly id: string;
  load(language: SpellLanguage): Promise<string[]>;
  /** How many times each word was accepted as a completion. */
  loadCounts?(language: SpellLanguage): Promise<Record<string, number>>;
  /** Records one accepted completion, so the word is suggested sooner next time. */
  recordAccept?(language: SpellLanguage, word: string): Promise<void>;
}

const COUNTS_KEY = 'likhari-completion-counts';

interface CountsByLanguage {
  [language: string]: Record<string, number>;
}

function readCounts(key: string): CountsByLanguage {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as CountsByLanguage) : {};
  } catch {
    return {};
  }
}

/**
 * The default: the dictionary's words plus the words the user has added. Accepted
 * completions are counted in this browser's localStorage, and the most accepted
 * words are suggested first.
 */
export function dictionaryCompletionStore(options: { countsKey?: string } = {}): CompletionStore {
  const key = options.countsKey ?? COUNTS_KEY;
  return {
    id: 'dictionary',
    async load(language) {
      const words = getDictionaryWords(language);
      const dictionary = words ? await words : [];
      return [...dictionary, ...acceptedWords(language)];
    },
    async loadCounts(language) {
      return readCounts(key)[language] ?? {};
    },
    async recordAccept(language, word) {
      const all = readCounts(key);
      const counts = all[language] ?? {};
      counts[word] = (counts[word] ?? 0) + 1;
      all[language] = counts;
      try {
        localStorage.setItem(key, JSON.stringify(all));
      } catch {
        // Storage full or disabled: the count is kept for this session only.
      }
    },
  };
}

/**
 * Words and counts served by an API. `load` calls `GET {url}?language=xx` for a JSON
 * array of strings; `loadCounts` calls `GET {url}/counts?language=xx` for a JSON
 * object of counts; `recordAccept` calls `POST {url}/accept` with `{ language, word }`.
 */
export function apiCompletionStore(options: {
  id?: string;
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): CompletionStore {
  const doFetch = options.fetch ?? fetch;
  const query = (language: SpellLanguage) => `?language=${encodeURIComponent(language)}`;
  return {
    id: options.id ?? 'api',
    async load(language) {
      const response = await doFetch(`${options.url}${query(language)}`, { headers: options.headers });
      if (!response.ok) throw new Error(`Completion API failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? data.filter((w): w is string => typeof w === 'string') : [];
    },
    async loadCounts(language) {
      const response = await doFetch(`${options.url}/counts${query(language)}`, { headers: options.headers });
      if (!response.ok) throw new Error(`Completion counts failed: ${response.status}`);
      const data: unknown = await response.json();
      return data && typeof data === 'object' ? (data as Record<string, number>) : {};
    },
    async recordAccept(language, word) {
      const response = await doFetch(`${options.url}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: JSON.stringify({ language, word }),
      });
      if (!response.ok) throw new Error(`Completion API rejected the count: ${response.status}`);
    },
  };
}
