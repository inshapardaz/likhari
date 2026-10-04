import { describe, expect, it } from 'vitest';
import { normalizeUrdu, normalizeUrduCharacters, removeUrduDiacritics, replaceUrduDigits } from './urduNormalize';

describe('normalizeUrdu', () => {
  it('replaces Arabic and presentation-form letters, as urduhack does', () => {
    // Example from urduhack's documentation for normalize_characters.
    expect(normalizeUrduCharacters('مجھ کو جو توڑا ﮔیا تھا')).toBe('مجھ کو جو توڑا گیا تھا');
  });

  it('maps a presentation-form ligature to its two letters', () => {
    expect(normalizeUrduCharacters('ﻻ')).toBe('لا');
  });

  it('removes tatweel', () => {
    expect(normalizeUrduCharacters('کـــتاب')).toBe('کتاب');
  });

  it('keeps diacritics unless asked to remove them', () => {
    const text = 'شَیر';
    expect(normalizeUrdu(text)).toBe(text);
    expect(normalizeUrdu(text, { removeDiacritics: true })).toBe('شیر');
    expect(removeUrduDiacritics(text)).toBe('شیر');
  });

  it('converts digits to English or Urdu when asked', () => {
    expect(replaceUrduDigits('۲۰ سال', 'english')).toBe('20 سال');
    expect(replaceUrduDigits('20', 'urdu')).toBe('۲۰');
    expect(normalizeUrdu('۲۰', { digits: 'keep' })).toBe('۲۰');
  });
});
