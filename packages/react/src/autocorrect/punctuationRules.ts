/**
 * Common Urdu punctuation and character fixes, as a snapshot of
 * https://api.nawishta.co.uk/tools/ur/spellchecker/punctuation (fetched 2026-10-04).
 * Bundled so the editor works offline and does not depend on that service;
 * refresh the list when the service changes.
 */
export interface PunctuationRule {
  incorrect: string;
  correct: string;
  /** When true, the match must be a whole word (not part of a longer one). */
  completeWord: boolean;
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
}

/** The rules in use for the options, longest match first, so `۔"` wins over `"`. */
export function activePunctuationRules(options: PunctuationOptions = {}): PunctuationRule[] {
  if (options.enabled === false) return [];
  const rules = URDU_PUNCTUATION_RULES.filter((rule) => rule.incorrect !== rule.correct);
  if (options.straightDoubleQuote !== false) rules.push({ incorrect: '"', correct: '”', completeWord: false });
  return rules.sort((a, b) => b.incorrect.length - a.incorrect.length);
}
