import type { SpellLanguage } from '../spellcheck/spellDictionaries';

/** One correction: a typed word and what it should become. */
export interface AutoCorrectEntry {
  from: string;
  to: string;
}

/**
 * Where auto-corrections come from and go. The host supplies any number of
 * stores; corrections from all of them are merged, and when two stores
 * correct the same word, the one listed first wins. New corrections are
 * appended to the first store that accepts writes.
 */
export interface AutoCorrectStore {
  readonly id: string;
  /** A store without `append` (or with `readOnly`) is never written to. */
  readonly readOnly?: boolean;
  load(language: SpellLanguage): Promise<AutoCorrectEntry[]>;
  append?(language: SpellLanguage, entry: AutoCorrectEntry): Promise<void>;
}

const STORAGE_KEY = 'likhari-autocorrect';

interface StoredEntry extends AutoCorrectEntry {
  language: SpellLanguage;
}

function isEntry(value: unknown): value is AutoCorrectEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AutoCorrectEntry).from === 'string' &&
    typeof (value as AutoCorrectEntry).to === 'string' &&
    (value as AutoCorrectEntry).from !== ''
  );
}

/**
 * Corrections kept in this browser's localStorage. Storage can be disabled or
 * full, so every access is guarded: a failure means "no corrections", never a
 * broken editor.
 */
export function localStorageAutoCorrectStore(options: { key?: string } = {}): AutoCorrectStore {
  const key = options.key ?? STORAGE_KEY;

  function readAll(): StoredEntry[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? (parsed.filter((e) => isEntry(e) && 'language' in e) as StoredEntry[]) : [];
    } catch {
      return [];
    }
  }

  return {
    id: 'local-storage',
    async load(language) {
      return readAll()
        .filter((e) => e.language === language)
        .map(({ from, to }) => ({ from, to }));
    },
    async append(language, entry) {
      const all = readAll().filter((e) => !(e.language === language && e.from === entry.from));
      all.push({ language, from: entry.from, to: entry.to });
      try {
        localStorage.setItem(key, JSON.stringify(all));
      } catch {
        // Quota exceeded or storage disabled: the correction is kept for this session only.
      }
    },
  };
}

/**
 * Corrections served by an API. `load` calls `GET {url}?language=xx` and expects
 * a JSON array of `{ from, to }`; `append` calls `POST {url}` with
 * `{ language, from, to }`. Credentials and headers belong to the host.
 */
export function apiAutoCorrectStore(options: {
  id?: string;
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): AutoCorrectStore {
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'api',
    async load(language) {
      const response = await doFetch(`${options.url}?language=${encodeURIComponent(language)}`, { headers: options.headers });
      if (!response.ok) throw new Error(`Auto-correct API failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? data.filter(isEntry).map(({ from, to }) => ({ from, to })) : [];
    },
    async append(language, entry) {
      const response = await doFetch(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        body: JSON.stringify({ language, from: entry.from, to: entry.to }),
      });
      if (!response.ok) throw new Error(`Auto-correct API rejected the entry: ${response.status}`);
    },
  };
}

/**
 * Corrections from a JSON file the host publishes — a list of `{ language, from, to }`.
 * Read-only: it has no way to write back to a static file.
 */
export function fileAutoCorrectStore(options: { id?: string; url: string; fetch?: typeof fetch }): AutoCorrectStore {
  const doFetch = options.fetch ?? fetch;
  let cached: Promise<StoredEntry[]> | null = null;
  const all = () => {
    cached ??= doFetch(options.url).then(async (response) => {
      if (!response.ok) throw new Error(`Auto-correct file failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? (data.filter((e) => isEntry(e) && 'language' in e) as StoredEntry[]) : [];
    });
    return cached;
  };
  return {
    id: options.id ?? 'file',
    readOnly: true,
    async load(language) {
      return (await all()).filter((e) => e.language === language).map(({ from, to }) => ({ from, to }));
    },
  };
}

/** Corrections for one language, merged across stores. Failing stores are skipped. */
export async function loadAutoCorrections(stores: AutoCorrectStore[], language: SpellLanguage): Promise<Map<string, string>> {
  const table = new Map<string, string>();
  const results = await Promise.allSettled(stores.map((store) => store.load(language)));
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    for (const entry of result.value) if (!table.has(entry.from)) table.set(entry.from, entry.to);
  });
  return table;
}

/** Saves a correction to the first store that accepts writes. Returns false if none does. */
export async function appendAutoCorrection(stores: AutoCorrectStore[], language: SpellLanguage, entry: AutoCorrectEntry): Promise<boolean> {
  const writable = stores.find((store) => !store.readOnly && store.append);
  if (!writable?.append) return false;
  await writable.append(language, entry);
  return true;
}
