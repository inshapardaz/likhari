import { describe, expect, it } from 'vitest';
import { WordIndex } from './wordIndex';

describe('WordIndex', () => {
  const index = new WordIndex(['cat', 'cattle', 'car', 'carpet', 'dog', 'cat', 'catalog']);

  it('completes a prefix with the words that start with it, shortest first', () => {
    expect(index.complete('ca')).toEqual(['car', 'cat', 'carpet', 'cattle', 'catalog']);
  });

  it('never suggests the prefix itself', () => {
    expect(index.complete('cat')).toEqual(['cattle', 'catalog']);
  });

  it('returns nothing for a prefix with no match, or an empty prefix', () => {
    expect(index.complete('zz')).toEqual([]);
    expect(index.complete('')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(index.complete('ca', 2)).toEqual(['car', 'cat']);
  });

  it('works for Urdu words in the same way', () => {
    const urdu = new WordIndex(['کتاب', 'کتابیں', 'قلم']);
    expect(urdu.complete('کتا')).toEqual(['کتاب', 'کتابیں']);
  });

  it('suggests the most accepted words first', () => {
    const counted = new WordIndex(['car', 'cat', 'cane'], { cane: 5, cat: 1 });
    expect(counted.complete('ca')).toEqual(['cane', 'cat', 'car']);
  });
});
