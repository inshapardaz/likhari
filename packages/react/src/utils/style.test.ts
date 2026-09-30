import { describe, expect, it } from 'vitest';
import { setStyleProperty } from './style';

describe('setStyleProperty', () => {
  it('adds a property to an empty style', () => {
    expect(setStyleProperty('', 'font-size', '18px')).toBe('font-size: 18px;');
  });

  it('replaces an existing property and keeps the others', () => {
    expect(setStyleProperty('font-size: 12px; color: red;', 'font-size', '20px')).toBe('color: red; font-size: 20px;');
  });

  it('keeps colons inside values, such as quoted font families', () => {
    expect(setStyleProperty('', 'font-family', '"Amiri", serif')).toBe('font-family: "Amiri", serif;');
    expect(setStyleProperty('background: url(a:b);', 'font-size', '14px')).toBe('background: url(a:b); font-size: 14px;');
  });
});
