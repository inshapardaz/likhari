import type { SpellLanguage } from '../spellcheck/spellDictionaries';

/**
 * Where synonyms come from. The host can pass several; their synonyms are merged
 * in order, without repeats. A failing store is skipped.
 */
export interface ThesaurusStore {
  readonly id: string;
  /** Synonyms of `word` in `language`. Returns [] when there are none. */
  lookup(word: string, language: SpellLanguage): Promise<string[]>;
}

const POS_FILES = ['noun', 'verb', 'adj', 'adv'] as const;

/** One WordNet index entry for a lemma in one part of speech: its synset offsets. */
interface IndexEntry {
  pos: string;
  offsets: string[];
}

/**
 * Parses a WordNet `index.<pos>` file: lemma → the synsets it belongs to. Lines
 * starting with a space are the licence header.
 */
export function parseWordNetIndex(text: string, pos: string): Map<string, IndexEntry[]> {
  const entries = new Map<string, IndexEntry[]>();
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith(' ')) continue;
    const fields = line.split(' ');
    const lemma = fields[0];
    const synsetCount = Number(fields[2]);
    const pointerCount = Number(fields[3]);
    // lemma pos synset_cnt p_cnt [pointer...] sense_cnt tagsense_cnt offset...
    const offsets = fields.slice(4 + pointerCount + 2, 4 + pointerCount + 2 + synsetCount);
    const list = entries.get(lemma) ?? [];
    list.push({ pos, offsets });
    entries.set(lemma, list);
  }
  return entries;
}

/**
 * Parses a WordNet `data.<pos>` file: synset offset → the words in that synset.
 * Multi-word entries use underscores in WordNet; they are returned with spaces.
 */
export function parseWordNetData(text: string): Map<string, string[]> {
  const synsets = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith(' ')) continue;
    const fields = line.split(' ');
    const offset = fields[0];
    const wordCount = parseInt(fields[3], 16);
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      // Each word is followed by its lex_id; a "(a)"-style marker is not part of the word.
      const word = fields[4 + i * 2].replace(/\(.*\)$/, '').replace(/_/g, ' ');
      words.push(word);
    }
    synsets.set(offset, words);
  }
  return synsets;
}

/**
 * English synonyms from WordNet. The database is about 35MB, so it is fetched
 * from `baseUrl` on the first lookup, and only the files needed are read.
 * Browsers cache the files after that.
 */
export function wordNetThesaurusStore(options: { baseUrl?: string; fetch?: typeof fetch } = {}): ThesaurusStore {
  const base = options.baseUrl ?? 'https://cdn.jsdelivr.net/npm/wordnet-db@3.1.14/dict/';
  const doFetch = options.fetch ?? fetch;
  const indexes = new Map<string, Promise<Map<string, IndexEntry[]>>>();
  const datas = new Map<string, Promise<Map<string, string[]>>>();

  const text = async (file: string): Promise<string> => {
    const response = await doFetch(`${base}${file}`);
    if (!response.ok) throw new Error(`WordNet file failed to load: ${file}`);
    return response.text();
  };
  const indexFor = (pos: string) => {
    let loaded = indexes.get(pos);
    if (!loaded) {
      loaded = text(`index.${pos}`).then((t) => parseWordNetIndex(t, pos));
      indexes.set(pos, loaded);
    }
    return loaded;
  };
  const dataFor = (pos: string) => {
    let loaded = datas.get(pos);
    if (!loaded) {
      loaded = text(`data.${pos}`).then(parseWordNetData);
      datas.set(pos, loaded);
    }
    return loaded;
  };

  return {
    id: 'wordnet',
    async lookup(word, language) {
      if (language !== 'en') return [];
      const lemma = word.trim().toLowerCase().replace(/ /g, '_');
      if (lemma === '') return [];
      const synonyms = new Set<string>();
      for (const pos of POS_FILES) {
        const entries = (await indexFor(pos)).get(lemma);
        if (!entries) continue;
        const synsets = await dataFor(pos);
        for (const entry of entries) {
          for (const offset of entry.offsets) {
            for (const synonym of synsets.get(offset) ?? []) {
              if (synonym.toLowerCase() !== lemma.replace(/_/g, ' ')) synonyms.add(synonym);
            }
          }
        }
      }
      return [...synonyms];
    },
  };
}

/** Synonyms from a service. `GET {url}?word=…&language=xx` returns a JSON array of strings. */
export function apiThesaurusStore(options: {
  id?: string;
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): ThesaurusStore {
  const doFetch = options.fetch ?? fetch;
  return {
    id: options.id ?? 'api',
    async lookup(word, language) {
      const query = `?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`;
      const response = await doFetch(`${options.url}${query}`, { headers: options.headers });
      if (!response.ok) throw new Error(`Thesaurus API failed: ${response.status}`);
      const data: unknown = await response.json();
      return Array.isArray(data) ? data.filter((s): s is string => typeof s === 'string') : [];
    },
  };
}

/** Synonyms of `word` from all stores, merged in order without repeats, at most `limit`. */
export async function lookupSynonyms(stores: ThesaurusStore[], word: string, language: SpellLanguage, limit = 10): Promise<string[]> {
  const results = await Promise.allSettled(stores.map((store) => store.lookup(word, language)));
  const merged = new Set<string>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const synonym of result.value) if (synonym !== word) merged.add(synonym);
  }
  return [...merged].slice(0, limit);
}
