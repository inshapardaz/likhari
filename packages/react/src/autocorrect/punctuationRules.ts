/**
 * Common Urdu punctuation and character fixes, as a snapshot of
 * https://api.nawishta.co.uk/tools/ur/spellchecker/punctuation (fetched 2026-10-04).
 * Bundled so the editor works offline and does not depend on that service;
 * refresh the list when the service changes.
 */
import { nearestDirection } from './scriptDirection';

export interface PunctuationRule {
  incorrect: string;
  correct: string;
  /** When true, the match must be a whole word (not part of a longer one). */
  completeWord: boolean;
  /**
   * When set, chooses the replacement from the text immediately before the
   * match, instead of using the fixed `correct` form. Used for the straight
   * double quote, which opens or closes depending on what comes before it —
   * macOS's native text substitution already does this, so without it the
   * same editor behaves differently depending on OS — and, in right-to-left
   * text, which of “ / ” is the opening mark is the reverse of the Latin
   * convention. `rtl` is only a fallback for when `before` holds no
   * strongly-directional character of its own to judge that from (e.g. the
   * quote opens the block): most callers pass the block's own direction.
   */
  resolve?: (before: string, rtl: boolean) => string;
}

export const URDU_PUNCTUATION_RULES: PunctuationRule[] = [
  { incorrect: ".", correct: "۔", completeWord: false },
  { incorrect: ",", correct: "،", completeWord: false },
  { incorrect: " ۔", correct: "۔", completeWord: false },
  { incorrect: " - ", correct: "۔ ", completeWord: false },
  { incorrect: " ،", correct: "،", completeWord: false },
  { incorrect: "?", correct: "؟", completeWord: false },
  { incorrect: " ؟", correct: "؟", completeWord: false },
  { incorrect: " !", correct: "!", completeWord: false },
  { incorrect: "( ", correct: "(", completeWord: false },
  { incorrect: " (", correct: "(", completeWord: false },
  { incorrect: "ه", correct: "ہ", completeWord: false },
  { incorrect: "ک", correct: "ک", completeWord: false },
  { incorrect: "ئو", correct: "ؤ", completeWord: false },
  { incorrect: "’’", correct: "”", completeWord: false },
  { incorrect: "‘‘", correct: "“", completeWord: false },
  { incorrect: "…", correct: "۔۔۔", completeWord: false },
  { incorrect: "——", correct: "۔۔۔", completeWord: false },
  { incorrect: "—", correct: "۔۔۔", completeWord: false },
  { incorrect: " ۔۔۔", correct: "۔۔۔ ", completeWord: false },
  { incorrect: "،،", correct: "“", completeWord: false },
  { incorrect: "۔\"", correct: "۔“", completeWord: false },
  { incorrect: "، \"", correct: "۔ ”", completeWord: false },
  { incorrect: "؟\"", correct: "؟“", completeWord: false },
  { incorrect: "!\"", correct: "!“", completeWord: false },
  { incorrect: "-", correct: "۔", completeWord: false },
  { incorrect: " ، ", correct: "، ", completeWord: false },
  { incorrect: " ۔", correct: "۔ ", completeWord: false },
  { incorrect: " : ", correct: ": ", completeWord: false },
  { incorrect: "آ", correct: "آ", completeWord: false },
  { incorrect: "ؤ", correct: "ؤ", completeWord: false },
  { incorrect: " ِ", correct: "ِ", completeWord: false },
  { incorrect: " ً", correct: "ً", completeWord: false },
  { incorrect: " :", correct: ":", completeWord: false },
  { incorrect: "” ", correct: "”", completeWord: false },
];

export interface PunctuationOptions {
  /** Apply the punctuation fixes. On by default. */
  enabled?: boolean;
  /** Replace a straight double quote (") with a closing curly quote (”). On by default. */
  straightDoubleQuote?: boolean;
  /** Space after Urdu punctuation and remove spaces before it, as urduhack's punctuations_space. Off by default. */
  spacing?: boolean;
}

/**
 * A double quote opens when it starts a quotation — at the start of the
 * text, or after whitespace, an opening bracket, a dash, or another opening
 * quote — and otherwise closes, the same heuristic macOS's native
 * substitution uses. Which mark (“ or ”) is the opening one depends on
 * direction: Urdu/Shahmukhi typesetting uses the pair in the opposite
 * order from Latin text, opening with ” and closing with “.
 */
const LTR_OPENING_QUOTE_CONTEXT = /[\s([{—–-“‘]$/u;
const RTL_OPENING_QUOTE_CONTEXT = /[\s([{—–-”’]$/u;

/**
 * Whether the quote's own context is right-to-left: judged from the script
 * of the nearest word in `before`, so a quote inside Urdu text picks the
 * Urdu convention even if the surrounding block's `dir` (passed as `rtl`,
 * used only as a fallback) is wrong — which happens whenever anything
 * earlier in the same block started with a Latin character.
 */
function isRtlHere(before: string, rtl: boolean): boolean {
  const direction = nearestDirection(before);
  return direction === null ? rtl : direction === 'rtl';
}

function resolveDoubleQuote(before: string, rtl: boolean): string {
  const rtlHere = isRtlHere(before, rtl);
  const context = rtlHere ? RTL_OPENING_QUOTE_CONTEXT : LTR_OPENING_QUOTE_CONTEXT;
  const opens = before === '' || context.test(before);
  return rtlHere ? (opens ? '”' : '“') : opens ? '“' : '”';
}

/** The rules in use for the options, longest match first, so `۔"` wins over `"`. */
export function activePunctuationRules(options: PunctuationOptions = {}): PunctuationRule[] {
  if (options.enabled === false) return [];
  const rules = URDU_PUNCTUATION_RULES.filter((rule) => rule.incorrect !== rule.correct);
  if (options.straightDoubleQuote !== false) {
    rules.push({ incorrect: '"', correct: '”', completeWord: false, resolve: resolveDoubleQuote });
    // Re-checks a curly quote already in the text (e.g. pasted, or typed before the block's
    // direction was known) and swaps it if it is the wrong one for its position — most often
    // an opening “ at the start of a right-to-left sentence, which should be ”.
    rules.push({ incorrect: '“', correct: '”', completeWord: false, resolve: resolveDoubleQuote });
    rules.push({ incorrect: '”', correct: '“', completeWord: false, resolve: resolveDoubleQuote });
  }
  return rules.sort((a, b) => b.incorrect.length - a.incorrect.length);
}

/** Space after Urdu punctuation, when the next character is not punctuation, a digit or a space. */
const SPACE_AFTER_PUNCTUATION = /(?<=[؛،٫؟۔٪])(?=[^؛،٫؟۔٪0-9 \n])/gu;
/** Spaces before Urdu punctuation. */
const SPACE_BEFORE_PUNCTUATION = /\s+([؛،٫؟۔٪])/gu;

/** Spaces after Urdu punctuation (not inside numbers), and none before it. */
export function spacePunctuationText(text: string): string {
  return text.replace(SPACE_AFTER_PUNCTUATION, ' ').replace(SPACE_BEFORE_PUNCTUATION, '$1');
}
