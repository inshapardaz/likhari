import nspell from 'nspell';
import { isAcceptedWord } from './userWords';

/** Languages the spellchecker has a dictionary slot for. */
export type SpellLanguage = 'en' | 'ur' | 'pa-shahmukhi';

/** A Hunspell dictionary as the two text files every Hunspell dictionary ships with. */
export interface HunspellFiles {
  /** Affix file: language, encoding, character rules. */
  aff: string;
  /** Dictionary file: one word per line, with optional affix flags. */
  dic: string;
}

export interface Speller {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

type Loader = () => Promise<HunspellFiles>;

const loaders = new Map<SpellLanguage, Loader>();
const loadedFiles = new Map<SpellLanguage, Promise<HunspellFiles>>();
const spellers = new Map<SpellLanguage, Promise<Speller>>();

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Spellcheck dictionary failed to load: ${url}`);
  return response.text();
}

// Where the English dictionary files are. Built from this module's own URL, so the
// files shipped next to it are found; a host that bundles the editor can point this
// elsewhere with setEnglishDictionaryBaseUrl.
let englishBaseUrl = import.meta.url.replace(/[^/]*$/, 'dictionaries/en/');

/** Sets where the English dictionary files are served from. Takes effect on the next load. */
export function setEnglishDictionaryBaseUrl(url: string): void {
  englishBaseUrl = url.endsWith('/') ? url : `${url}/`;
  loadedFiles.delete('en');
  spellers.delete('en');
}

/** English ships with the editor: its files are fetched on first use. */
const englishLoader: Loader = async () => ({
  aff: await fetchText(`${englishBaseUrl}index.aff`),
  dic: await fetchText(`${englishBaseUrl}index.dic`),
});

loaders.set('en', englishLoader);

/**
 * Registers a dictionary for a language. Call once at startup with files you
 * have licence to ship — e.g. the Urdu `.aff`/`.dic` pair — either as strings
 * or as a loader that fetches them on demand. Registering again replaces the
 * previous dictionary for that language.
 */
export function registerSpellDictionary(language: SpellLanguage, files: HunspellFiles | Loader): void {
  loaders.set(language, typeof files === 'function' ? files : async () => files);
  spellers.delete(language);
  loadedFiles.delete(language);
}

/** Whether a dictionary is registered for the language. */
export function hasSpellDictionary(language: SpellLanguage): boolean {
  return loaders.has(language);
}

/**
 * The speller for a language, loading its dictionary the first time it is
 * asked for. Resolves to null when no dictionary is registered, so callers
 * can skip spellchecking that language rather than flag every word.
 */
export function getSpeller(language: SpellLanguage): Promise<Speller> | null {
  if (!loaders.has(language)) return null;
  let speller = spellers.get(language);
  if (!speller) {
    speller = filesFor(language)
      .then(({ aff, dic }) => nspell(aff, dic))
      .then((base) => ({
        // Words the user added or ignored count as correct, whatever the dictionary says.
        correct: (word: string) => isAcceptedWord(language, word) || base.correct(word),
        suggest: (word: string) => base.suggest(word),
      }));
    spellers.set(language, speller);
  }
  return speller;
}

/** The dictionary's files, loaded once per language and shared by the speller and the word list. */
function filesFor(language: SpellLanguage): Promise<HunspellFiles> {
  let loaded = loadedFiles.get(language);
  if (!loaded) {
    loaded = loaders.get(language)!();
    loadedFiles.set(language, loaded);
  }
  return loaded;
}

/** The dictionary's root words (its .dic entries without affix flags), for completion. */
export function dictionaryWords(dic: string): string[] {
  const words = new Set<string>();
  for (const line of dic.split(/\r?\n/).slice(1)) {
    const word = line.split('/')[0].trim();
    if (word) words.add(word);
  }
  return [...words];
}

/** The language's dictionary words, or null when no dictionary is registered. */
export function getDictionaryWords(language: SpellLanguage): Promise<string[]> | null {
  if (!loaders.has(language)) return null;
  return filesFor(language).then(({ dic }) => dictionaryWords(dic));
}

/** A word in a text, with its position as character offsets. */
export interface WordSpan {
  word: string;
  start: number;
  end: number;
}

/**
 * Letters and combining marks, with apostrophes inside a word kept. The
 * Unicode classes cover Arabic-script letters and their diacritics, so Urdu
 * and Shahmukhi words are found the same way English ones are.
 */
const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

export function wordsIn(text: string): WordSpan[] {
  return [...text.matchAll(WORD)].map((match) => ({
    word: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

/** The words in `text` the speller does not recognise. */
export function misspellingsIn(text: string, speller: Speller): WordSpan[] {
  return wordsIn(text).filter((span) => !speller.correct(span.word));
}
