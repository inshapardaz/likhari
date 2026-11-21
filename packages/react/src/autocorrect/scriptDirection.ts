/**
 * Arabic-script ranges (Urdu, Shahmukhi and their presentation forms), and
 * Latin letters, used to judge a word's or a run of text's direction from
 * its own characters rather than from a Lexical block's `dir` — which is
 * unreliable for this: Lexical sets a block's direction from only the first
 * strongly-directional character anywhere in it, so one stray Latin letter
 * before the first Urdu character mislabels the whole block.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_SCRIPT = /[A-Za-zÀ-ÿ]/;

/** Whether `word` is in Arabic script (Urdu/Shahmukhi), judged by its own characters. */
export function isRtlWord(word: string): boolean {
  return ARABIC_SCRIPT.test(word);
}

/**
 * The script of the nearest strongly-directional character, scanning
 * backward from the end of `text` — null if `text` holds no Arabic-script or
 * Latin letter at all (e.g. it's empty, or only punctuation/digits/spaces).
 */
export function nearestDirection(text: string): 'rtl' | 'ltr' | null {
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (ARABIC_SCRIPT.test(char)) return 'rtl';
    if (LATIN_SCRIPT.test(char)) return 'ltr';
  }
  return null;
}
