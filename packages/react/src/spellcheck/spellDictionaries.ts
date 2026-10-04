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
const spellers = new Map<SpellLanguage, Promise<Speller>>();

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Spellcheck dictionary failed to load: ${url}`);
  return response.text();
}

/** English ships with the editor: its files are fetched on first use. */
const englishLoader: Loader = async () => ({
  aff: await fetchText(new URL('./dictionaries/en/index.aff', import.meta.url).href),
  dic: await fetchText(new URL('./dictionaries/en/index.dic', import.meta.url).href),
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
  const loader = loaders.get(language);
  if (!loader) return null;
  let speller = spellers.get(language);
  if (!speller) {
    speller = loader()
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
