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

interface NawishtaArticle {
  headword?: unknown;
  senses?: { meanings?: { definition?: unknown }[] }[];
}

/** Normalises a headword for comparing against the looked-up word: surrounding
 * and repeated whitespace, and the Urdu/Arabic diacritics dictionaries add
 * to headwords but writers rarely type. */
function normalizeHeadword(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * One dictionary from nawishta's library, https://api.nawishta.co.uk — its
 * `GET /dictionaries/{id}/articles?query=…` is a substring search over
 * headwords, so this takes the page and keeps only the article(s) whose
 * headword is the word itself. Every dictionary there is Urdu (or Punjabi
 * Shahmukhi), so English lookups are answered with null straight away.
 */
export function nawishtaDictionaryStore(options: {
  dictionaryId: number;
  label: string;
  id?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}): DictionaryStore {
  const base = (options.baseUrl ?? 'https://api.nawishta.co.uk').replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? `nawishta-${options.dictionaryId}`,
    label: options.label,
    async lookup(word, language) {
      if (language === 'en') return null;
      const url = `${base}/dictionaries/${options.dictionaryId}/articles?query=${encodeURIComponent(word)}&pageSize=200`;
      const response = await doFetch(url);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Nawishta dictionary API failed: ${response.status}`);
      const data: unknown = await response.json();
      const articles = (data as { data?: unknown })?.data;
      if (!Array.isArray(articles)) return null;
      const wanted = normalizeHeadword(word);
      const meanings: string[] = [];
      let headword: string | null = null;
      for (const article of articles as NawishtaArticle[]) {
        if (typeof article.headword !== 'string' || normalizeHeadword(article.headword) !== wanted) continue;
        headword ??= article.headword.trim();
        for (const sense of article.senses ?? []) {
          for (const meaning of sense.meanings ?? []) {
            if (typeof meaning.definition === 'string' && meaning.definition.trim()) meanings.push(meaning.definition.trim());
          }
        }
      }
      return meanings.length > 0 ? { word: headword ?? word, meanings } : null;
    },
  };
}

/**
 * Every dictionary nawishta's library lists (`GET /dictionaries`), as lookup
 * stores named after them — for a host that wants whatever the library
 * offers rather than a fixed set of ids. Rejects when the list can't be read.
 */
export async function listNawishtaDictionaryStores(options: { baseUrl?: string; fetch?: typeof fetch } = {}): Promise<DictionaryStore[]> {
  const base = (options.baseUrl ?? 'https://api.nawishta.co.uk').replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(`${base}/dictionaries?pageSize=100`);
  if (!response.ok) throw new Error(`Nawishta dictionary API failed: ${response.status}`);
  const data: unknown = await response.json();
  const list = (data as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return (list as { id?: unknown; name?: unknown }[])
    .filter((d): d is { id: number; name: string } => typeof d.id === 'number' && typeof d.name === 'string')
    .map((d) => nawishtaDictionaryStore({ dictionaryId: d.id, label: d.name, baseUrl: base, fetch: options.fetch }));
}
