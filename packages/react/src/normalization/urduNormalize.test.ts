import { describe, expect, it } from 'vitest';
import { filterDiacriticsByLevel, normalizeUrdu, normalizeUrduCharacters, removeUrduDiacritics, replaceUrduDigits } from './urduNormalize';

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

describe('filterDiacriticsByLevel', () => {
  it('keeps only tashdid/maddah at the minimal level', () => {
    expect(filterDiacriticsByLevel('اُمّید', 'minimal')).toBe('امّید');
  });

  it('adds short vowels at the normal level', () => {
    expect(filterDiacriticsByLevel('اُمّید', 'normal')).toBe('اُمّید');
  });

  it('drops tanwin unless the level is maximum', () => {
    expect(filterDiacriticsByLevel('فوراً', 'minimal')).toBe('فورا');
    expect(filterDiacriticsByLevel('فوراً', 'normal')).toBe('فورا');
    expect(filterDiacriticsByLevel('فوراً', 'maximum')).toBe('فوراً');
  });

  it('leaves text with no diacritics unchanged at every level', () => {
    expect(filterDiacriticsByLevel('امید', 'minimal')).toBe('امید');
    expect(filterDiacriticsByLevel('امید', 'maximum')).toBe('امید');
  });
});
