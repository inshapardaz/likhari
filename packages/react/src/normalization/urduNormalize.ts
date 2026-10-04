/**
 * Urdu character normalisation, ported from urduhack's `normalization/character.py`
 * (MIT licence, https://github.com/urduhack/urduhack). The mapping replaces
 * Arabic and presentation-form letters with the standard Urdu letter, and
 * the tables below keep the same entries and order as the original, so the
 * output matches it character for character.
 */

const CORRECT_URDU_CHARACTERS: Record<string, string[]> = {
  "آ": ["ﺁ", "ﺂ"],
  "أ": ["ﺃ"],
  "ا": ["ﺍ", "ﺎ"],
  "ب": ["ﺏ", "ﺐ", "ﺑ", "ﺒ"],
  "پ": ["ﭖ", "ﭘ", "ﭙ"],
  "ت": ["ﺕ", "ﺖ", "ﺗ", "ﺘ"],
  "ٹ": ["ﭦ", "ﭧ", "ﭨ", "ﭩ"],
  "ث": ["ﺛ", "ﺜ", "ﺚ"],
  "ج": ["ﺝ", "ﺞ", "ﺟ", "ﺠ"],
  "ح": ["ﺡ", "ﺣ", "ﺤ", "ﺢ"],
  "خ": ["ﺧ", "ﺨ", "ﺦ"],
  "د": ["ﺩ", "ﺪ"],
  "ذ": ["ﺬ", "ﺫ"],
  "ر": ["ﺭ", "ﺮ"],
  "ز": ["ﺯ", "ﺰ"],
  "س": ["ﺱ", "ﺲ", "ﺳ", "ﺴ"],
  "ش": ["ﺵ", "ﺶ", "ﺷ", "ﺸ"],
  "ص": ["ﺹ", "ﺺ", "ﺻ", "ﺼ"],
  "ض": ["ﺽ", "ﺾ", "ﺿ", "ﻀ"],
  "ط": ["ﻃ", "ﻄ"],
  "ظ": ["ﻅ", "ﻇ", "ﻈ"],
  "ع": ["ﻉ", "ﻊ", "ﻋ", "ﻌ"],
  "غ": ["ﻍ", "ﻏ", "ﻐ"],
  "ف": ["ﻑ", "ﻒ", "ﻓ", "ﻔ"],
  "ق": ["ﻕ", "ﻖ", "ﻗ", "ﻘ"],
  "ل": ["ﻝ", "ﻞ", "ﻟ", "ﻠ"],
  "م": ["ﻡ", "ﻢ", "ﻣ", "ﻤ"],
  "ن": ["ﻥ", "ﻦ", "ﻧ", "ﻨ"],
  "چ": ["ﭺ", "ﭻ", "ﭼ", "ﭽ"],
  "ڈ": ["ﮈ", "ﮉ"],
  "ڑ": ["ﮍ", "ﮌ"],
  "ژ": ["ﮋ"],
  "ک": ["ﮎ", "ﮏ", "ﮐ", "ﮑ", "ﻛ", "ك"],
  "گ": ["ﮒ", "ﮓ", "ﮔ", "ﮕ"],
  "ں": ["ﮞ", "ﮟ"],
  "و": ["ﻮ", "ﻭ", "ﻮ"],
  "ؤ": ["ﺅ"],
  "ھ": ["ﮪ", "ﮬ", "ﮭ", "ﻬ", "ﻫ", "ﮫ"],
  "ہ": ["ﻩ", "ﮦ", "ﻪ", "ﮧ", "ﮩ", "ﮨ", "ه"],
  "ۂ": [],
  "ۃ": ["ة"],
  "ء": ["ﺀ"],
  "ی": ["ﯼ", "ى", "ﯽ", "ﻰ", "ﻱ", "ﻲ", "ﯾ", "ﯿ", "ي"],
  "ئ": ["ﺋ", "ﺌ"],
  "ے": ["ﮮ", "ﮯ", "ﻳ", "ﻴ"],
  "ۓ": [],
  "۰": ["٠"],
  "۱": ["١"],
  "۲": ["٢"],
  "۳": ["٣"],
  "۴": ["٤"],
  "۵": ["٥"],
  "۶": ["٦"],
  "۷": ["٧"],
  "۸": ["٨"],
  "۹": ["٩"],
  "۔": [],
  "؟": [],
  "٫": [],
  "،": [],
  "لا": ["ﻻ", "ﻼ"],
  "": ["ـ"],
};

const TRANSLATOR = new Map<string, string>();
for (const [key, values] of Object.entries(CORRECT_URDU_CHARACTERS)) {
  for (const value of values) TRANSLATOR.set(value, key);
}

/** Combining diacritics (harakat and similar), as urduhack's URDU_DIACRITICS. */
const DIACRITICS = new Set(['َ', 'ً', 'ٰ', 'ِ', 'ُ', 'ٍ']);

const ENGLISH_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const URDU_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Replaces Arabic and presentation-form letters with standard Urdu letters, character by character. */
export function normalizeUrduCharacters(text: string): string {
  let out = '';
  for (const char of text) out += TRANSLATOR.get(char) ?? char;
  return out;
}

export function removeUrduDiacritics(text: string): string {
  let out = '';
  for (const char of text) if (!DIACRITICS.has(char)) out += char;
  return out;
}

/** Converts Urdu digits to English digits, or the reverse. */
export function replaceUrduDigits(text: string, to: 'english' | 'urdu'): string {
  const from = to === 'english' ? URDU_DIGITS : ENGLISH_DIGITS;
  const target = to === 'english' ? ENGLISH_DIGITS : URDU_DIGITS;
  let out = '';
  for (const char of text) {
    const index = from.indexOf(char);
    out += index === -1 ? char : target[index];
  }
  return out;
}

export interface UrduNormalizationOptions {
  /** Remove harakat. Off by default, since they are meaningful in poetry and religious text. */
  removeDiacritics?: boolean;
  /** Digit style to convert to; 'keep' (the default) leaves digits as they are. */
  digits?: 'keep' | 'english' | 'urdu';
}

/**
 * The normalisation urduhack's `normalize` applies, with the diacritic and
 * digit steps made optional. Character mapping always runs.
 */
export function normalizeUrdu(text: string, options: UrduNormalizationOptions = {}): string {
  let out = options.removeDiacritics ? removeUrduDiacritics(text) : text;
  out = normalizeUrduCharacters(out);
  if (options.digits === 'english' || options.digits === 'urdu') out = replaceUrduDigits(out, options.digits);
  return out;
}
