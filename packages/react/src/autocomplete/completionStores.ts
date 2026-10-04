import { getDictionaryWords, type SpellLanguage } from '../spellcheck/spellDictionaries';
import { acceptedWords } from '../spellcheck/userWords';

/**
 * Where autocomplete words come from. The host can pass several; their words
 * are combined per language. Like the other stores, a failing store is skipped.
 */
export interface CompletionStore {
  readonly id: string;
  load(language: SpellLanguage): Promise<string[]>;
}

/**
 * The default: the dictionary's words plus the words the user has added. Nothing
 * to configure; it follows whichever spelling dictionaries are registered.
 */
export function dictionaryCompletionStore(): CompletionStore {
  return {
    id: 'dictionary',
    async load(language) {
      const words = getDictionaryWords(language);
      const dictionary = words ? await words : [];
      return [...dictionary, ...acceptedWords(language)];
    },
  };
}

/**
 * Words served by an API. `load` calls `GET {url}?language=xx` and expects a JSON
 * array of strings.
 */
export function apiCompletionStore(options: {
  id?: string;
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): CompletionStore {
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'api',
    async load(language) {
      const response = await doFetch(`${options.url}?language=${encodeURIComponent(language)}`, { headers: options.headers });
      if (!response.ok) throw new Error(`Completion API failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? data.filter((w): w is string => typeof w === 'string') : [];
    },
  };
}
