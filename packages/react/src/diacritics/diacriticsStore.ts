import type { SpellLanguage } from '../spellcheck/spellDictionaries';
import { filterDiacriticsByLevel, type DiacriticLevel } from '../normalization/urduNormalize';

/** A word and its fully-vowelled form; levels are derived from this, not stored separately. */
export interface DiacriticsEntry {
  word: string;
  vowelled: string;
}

/**
 * Where fully-vowelled forms come from — curated reference data, not
 * something the editor writes back to, so there is no `append` (unlike
 * `AutoCorrectStore`).
 */
export interface DiacriticsStore {
  readonly id: string;
  load(language: SpellLanguage): Promise<DiacriticsEntry[]>;
}

function isEntry(value: unknown): value is DiacriticsEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DiacriticsEntry).word === 'string' &&
    typeof (value as DiacriticsEntry).vowelled === 'string' &&
    (value as DiacriticsEntry).word !== ''
  );
}

interface StoredEntry extends DiacriticsEntry {
  language: SpellLanguage;
}

/** Fully-vowelled forms from a JSON file the host publishes: a list of `{ language, word, vowelled }`. */
export function fileDiacriticsStore(options: { id?: string; url: string; fetch?: typeof fetch }): DiacriticsStore {
  const doFetch = options.fetch ?? fetch;
  let cached: Promise<StoredEntry[]> | null = null;
  const all = () => {
    cached ??= doFetch(options.url).then(async (response) => {
      if (!response.ok) throw new Error(`Diacritics file failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? (data.filter((e) => isEntry(e) && 'language' in e) as StoredEntry[]) : [];
    });
    return cached;
  };
  return {
    id: options.id ?? 'file',
    async load(language) {
      return (await all()).filter((e) => e.language === language).map(({ word, vowelled }) => ({ word, vowelled }));
    },
  };
}

/** Fully-vowelled forms served by an API: `GET {url}?language=xx`, expecting `{ word, vowelled }[]`. */
export function apiDiacriticsStore(options: { id?: string; url: string; headers?: Record<string, string>; fetch?: typeof fetch }): DiacriticsStore {
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'api',
    async load(language) {
      const response = await doFetch(`${options.url}?language=${encodeURIComponent(language)}`, { headers: options.headers });
      if (!response.ok) throw new Error(`Diacritics API failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? data.filter(isEntry) : [];
    },
  };
}

/** Every fully-vowelled entry for one language, merged across stores (the first listed wins a clash). Failing stores are skipped. */
export async function loadDiacriticsEntries(stores: DiacriticsStore[], language: SpellLanguage): Promise<DiacriticsEntry[]> {
  const seen = new Set<string>();
  const merged: DiacriticsEntry[] = [];
  const results = await Promise.allSettled(stores.map((store) => store.load(language)));
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    for (const entry of result.value) {
      if (seen.has(entry.word)) continue;
      seen.add(entry.word);
      merged.push(entry);
    }
  });
  return merged;
}

/**
 * The bare-word-to-vowelled-word table for one language at one level, merged
 * across stores. The level is applied here, once, rather than by every
 * caller: the stored data always holds the fully-vowelled ("maximum") form.
 */
export async function loadDiacriticsTable(stores: DiacriticsStore[], language: SpellLanguage, level: DiacriticLevel): Promise<Map<string, string>> {
  const entries = await loadDiacriticsEntries(stores, language);
  const table = new Map<string, string>();
  for (const entry of entries) {
    const thinned = filterDiacriticsByLevel(entry.vowelled, level);
    if (thinned !== entry.word) table.set(entry.word, thinned);
  }
  return table;
}
