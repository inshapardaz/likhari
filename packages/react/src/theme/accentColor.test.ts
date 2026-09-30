import { describe, expect, it } from 'vitest';
import { generateAccentCssVars, generateAccentShades, hexToRgb } from './accentColor';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#2B6E6E')).toEqual({ r: 0x2b, g: 0x6e, b: 0x6e });
  });

  it('parses a 3-digit hex color', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns null for anything that is not a hex color', () => {
    expect(hexToRgb('teal')).toBeNull();
    expect(hexToRgb('#12')).toBeNull();
  });
});

describe('generateAccentShades', () => {
  it('returns 10 shades with shade 6 equal to the exact input color', () => {
    const shades = generateAccentShades('#2B6E6E');
    expect(shades).not.toBeNull();
    expect(shades).toHaveLength(10);
    expect(shades![6].toLowerCase()).toBe('#2b6e6e');
  });

  it('lightens the low shades and darkens the high ones relative to shade 6', () => {
    const shades = generateAccentShades('#2B6E6E')!;
    expect(hexToRgb(shades[0])!.r).toBeGreaterThan(hexToRgb(shades[6])!.r);
    expect(hexToRgb(shades[9])!.r).toBeLessThan(hexToRgb(shades[6])!.r);
  });

  it('returns null for an invalid color', () => {
    expect(generateAccentShades('not-a-color')).toBeNull();
  });
});

describe('generateAccentCssVars', () => {
  it('keeps the accent as given in light mode, with a light-tinted soft variant', () => {
    const vars = generateAccentCssVars('#2B6E6E', 'light');
    expect(vars).toEqual({ accent: '#2B6E6E', accentSoft: expect.any(String) });
    const soft = hexToRgb(vars!.accentSoft)!;
    const base = hexToRgb('#2B6E6E')!;
    expect(soft.r).toBeGreaterThan(base.r);
  });

  it('lightens the accent and dark-tints the soft variant in dark mode', () => {
    const vars = generateAccentCssVars('#2B6E6E', 'dark')!;
    const base = hexToRgb('#2B6E6E')!;
    expect(hexToRgb(vars.accent)!.r).toBeGreaterThan(base.r);
    expect(hexToRgb(vars.accentSoft)!.r).toBeLessThan(base.r);
  });

  it('returns null for an invalid color', () => {
    expect(generateAccentCssVars('nope', 'light')).toBeNull();
  });
});
