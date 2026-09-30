import { describe, expect, it } from 'vitest';
import { MIN_CROP, moveRect, rectFromDrag, resizeRect } from './cropMath';

const box = { width: 400, height: 200 };
const rect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

describe('rectFromDrag', () => {
  it('builds a rectangle from any drag direction', () => {
    expect(rectFromDrag({ x: 0.5, y: 0.5 }, { x: 0.25, y: 0.75 }, null, box)).toEqual({ x: 0.25, y: 0.5, w: 0.25, h: 0.25 });
  });

  it('keeps a pixel aspect ratio', () => {
    const r = rectFromDrag({ x: 0, y: 0 }, { x: 0.5, y: 0.9 }, 1, box);
    expect((r.w * box.width) / (r.h * box.height)).toBeCloseTo(1);
  });

  it('stays inside the image when the pointer leaves it', () => {
    const r = rectFromDrag({ x: 0.5, y: 0.5 }, { x: 2, y: 2 }, null, box);
    expect(r.x + r.w).toBeLessThanOrEqual(1);
    expect(r.y + r.h).toBeLessThanOrEqual(1);
  });
});

describe('moveRect', () => {
  it('moves and clamps to the image', () => {
    expect(moveRect(rect, 0.1, -0.1)).toEqual({ x: 0.35, y: 0.15, w: 0.5, h: 0.5 });
    expect(moveRect(rect, 5, 5)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(moveRect(rect, -5, -5)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
  });
});

describe('resizeRect', () => {
  it('drags an edge and leaves the others', () => {
    expect(resizeRect(rect, 'e', { x: 0.9, y: 0.1 }, null, box)).toEqual({ x: 0.25, y: 0.25, w: 0.65, h: 0.5 });
    expect(resizeRect(rect, 'n', { x: 0.1, y: 0.1 }, null, box)).toEqual({ x: 0.25, y: 0.1, w: 0.5, h: 0.65 });
  });

  it('drags a corner, anchoring the opposite one', () => {
    const r = resizeRect(rect, 'nw', { x: 0.1, y: 0.1 }, null, box);
    expect(r.x + r.w).toBeCloseTo(0.75);
    expect(r.y + r.h).toBeCloseTo(0.75);
    expect(r.x).toBeCloseTo(0.1);
  });

  it('never collapses below the minimum', () => {
    const r = resizeRect(rect, 'e', { x: 0, y: 0 }, null, box);
    expect(r.w).toBeCloseTo(MIN_CROP);
  });

  it('keeps the ratio when an edge is dragged', () => {
    const r = resizeRect({ x: 0.1, y: 0.1, w: 0.25, h: 0.5 }, 'e', { x: 0.6, y: 0.3 }, 1, box);
    expect((r.w * box.width) / (r.h * box.height)).toBeCloseTo(1);
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9);
  });
});
