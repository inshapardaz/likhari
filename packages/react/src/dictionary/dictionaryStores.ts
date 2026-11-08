import type { SpellLanguage } from '../spellcheck/spellDictionaries';

/** One dictionary's entry for a word: its headword plus one or more meanings/senses. */
export interface DictionaryEntry {
  /** The headword as the dictionary spells it — may differ from the looked-up word (e.g. its lemma). */
  word: string;
  /** One line per sense, e.g. "noun: a greeting". */
  meanings: string[];
}

/**
 * A dictionary the right-click "Look up" popup can query. The host can offer
 * several; the popup lets the user pick which one to show, re-querying the
 * current word when the choice changes (it does not merge them, unlike
 * `ThesaurusStore`, since definitions from different dictionaries are shown
 * one at a time, not combined).
 */
export interface DictionaryStore {
  readonly id: string;
  /** Shown to the user when choosing which dictionary to look a word up in. */
  readonly label: string;
  /** The entry for `word` in `language`, or null when this dictionary has none (or doesn't cover the language). */
  lookup(word: string, language: SpellLanguage): Promise<DictionaryEntry | null>;
}

interface FreeDictionaryApiMeaning {
  partOfSpeech?: unknown;
  definitions?: { definition?: unknown }[];
}
interface FreeDictionaryApiEntry {
  word?: unknown;
  meanings?: FreeDictionaryApiMeaning[];
}

/**
 * English definitions from the free, keyless dictionaryapi.dev service
 * (`GET {baseUrl}/en/{word}`). Used as the default English dictionary when
 * the host configures none of its own.
 */
export function freeDictionaryApiStore(options: { id?: string; label?: string; baseUrl?: string; fetch?: typeof fetch } = {}): DictionaryStore {
  const base = options.baseUrl ?? 'https://api.dictionaryapi.dev/api/v2/entries';
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'free-dictionary-api',
    label: options.label ?? 'English dictionary',
    async lookup(word, language) {
      if (language !== 'en') return null;
      const response = await doFetch(`${base}/en/${encodeURIComponent(word)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Dictionary API failed: ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const meanings: string[] = [];
      for (const entry of data as FreeDictionaryApiEntry[]) {
        for (const meaning of entry.meanings ?? []) {
          const partOfSpeech = typeof meaning.partOfSpeech === 'string' ? meaning.partOfSpeech : undefined;
          for (const definition of meaning.definitions ?? []) {
            const text = definition.definition;
            if (typeof text === 'string') meanings.push(partOfSpeech ? `${partOfSpeech}: ${text}` : text);
          }
        }
      }
      if (meanings.length === 0) return null;
      const headword = data[0] as FreeDictionaryApiEntry;
      return { word: typeof headword.word === 'string' ? headword.word : word, meanings };
    },
  };
}

/** A dictionary served from the host's own backend. `GET {url}?word=…&language=xx` returns `{ word: string, meanings: string[] }`, or 404 for no entry. */
export function apiDictionaryStore(options: {
  id?: string;
  label: string;
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): DictionaryStore {
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'api',
    label: options.label,
    async lookup(word, language) {
      const query = `?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`;
      const response = await doFetch(`${options.url}${query}`, { headers: options.headers });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Dictionary API failed: ${response.status}`);
      const data: unknown = await response.json();
      if (typeof data !== 'object' || data === null) return null;
      const headword = (data as { word?: unknown }).word;
      const meanings = (data as { meanings?: unknown }).meanings;
      if (!Array.isArray(meanings)) return null;
      const strings = meanings.filter((m): m is string => typeof m === 'string');
      return strings.length > 0 ? { word: typeof headword === 'string' ? headword : word, meanings: strings } : null;
    },
  };
}
