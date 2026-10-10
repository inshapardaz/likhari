import { describe, expect, it } from 'vitest';
import { clampZoom, ZOOM_DEFAULT_PERCENT, ZOOM_MAX_PERCENT, ZOOM_MIN_PERCENT } from './index';

describe('clampZoom', () => {
  it('keeps a value in range, rounded to a whole percent', () => {
    expect(clampZoom(125)).toBe(125);
    expect(clampZoom(133.4)).toBe(133);
  });

  it('limits to the supported range', () => {
    expect(clampZoom(5)).toBe(ZOOM_MIN_PERCENT);
    expect(clampZoom(1000)).toBe(ZOOM_MAX_PERCENT);
  });

  it('falls back to 100% for a missing or invalid value', () => {
    expect(clampZoom(undefined)).toBe(ZOOM_DEFAULT_PERCENT);
    expect(clampZoom(Number.NaN)).toBe(ZOOM_DEFAULT_PERCENT);
  });
});
