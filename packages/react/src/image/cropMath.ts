import type { CropRect } from './imageEdit';

export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Smallest selection, as a fraction of the image. */
export const MIN_CROP = 0.02;

/** Size of the image's on-screen box in px; needed to keep an aspect ratio,
 * since rectangle coordinates are fractions. */
export interface Box {
  width: number;
  height: number;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);

/**
 * A new selection dragged from `anchor` to `point` (both fractions). With a
 * `ratio` (width / height, in pixels) the selection keeps it, shrinking to stay
 * inside the image.
 */
export function rectFromDrag(anchor: { x: number; y: number }, point: { x: number; y: number }, ratio: number | null, box: Box): CropRect {
  let dx = clamp(point.x) - anchor.x;
  let dy = clamp(point.y) - anchor.y;
  if (ratio) {
    let widthPx = Math.abs(dx) * box.width;
    let heightPx = widthPx / ratio;
    const maxHeightPx = (dy >= 0 ? 1 - anchor.y : anchor.y) * box.height;
    if (heightPx > maxHeightPx) {
      heightPx = maxHeightPx;
      widthPx = heightPx * ratio;
    }
    dx = (dx >= 0 ? 1 : -1) * (widthPx / box.width);
    dy = (dy >= 0 ? 1 : -1) * (heightPx / box.height);
  }
  return { x: Math.min(anchor.x, anchor.x + dx), y: Math.min(anchor.y, anchor.y + dy), w: Math.abs(dx), h: Math.abs(dy) };
}

/** Moves a selection by (dx, dy) fractions, keeping it inside the image. */
export function moveRect(rect: CropRect, dx: number, dy: number): CropRect {
  return { ...rect, x: clamp(rect.x + dx, 0, 1 - rect.w), y: clamp(rect.y + dy, 0, 1 - rect.h) };
}

/**
 * Resizes a selection by dragging one of its handles to `point` (a fraction).
 * Corners anchor the opposite corner; edges move one side. With a `ratio` the
 * aspect is kept (an edge handle then grows the other dimension around the
 * selection's centre). Never smaller than MIN_CROP, never outside the image.
 */
export function resizeRect(rect: CropRect, handle: CropHandle, point: { x: number; y: number }, ratio: number | null, box: Box): CropRect {
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;
  const px = clamp(point.x);
  const py = clamp(point.y);

  if (handle.length === 2) {
    // Corner: the opposite corner stays put.
    const anchor = { x: handle.includes('w') ? right : left, y: handle.includes('n') ? bottom : top };
    return rectFromDrag(anchor, { x: px, y: py }, ratio, box);
  }

  const horizontal = handle === 'e' || handle === 'w';
  if (!ratio) {
    const next = { left, right, top, bottom };
    if (handle === 'w') next.left = Math.min(px, right - MIN_CROP);
    if (handle === 'e') next.right = Math.max(px, left + MIN_CROP);
    if (handle === 'n') next.top = Math.min(py, bottom - MIN_CROP);
    if (handle === 's') next.bottom = Math.max(py, top + MIN_CROP);
    return { x: next.left, y: next.top, w: next.right - next.left, h: next.bottom - next.top };
  }

  // Edge with a locked ratio: the dragged side sets one dimension, the other follows.
  const cx = left + rect.w / 2;
  const cy = top + rect.h / 2;
  if (horizontal) {
    const fixed = handle === 'e' ? left : right;
    let w = Math.max(Math.abs(px - fixed), MIN_CROP);
    let h = w * box.width / ratio / box.height;
    if (h > 1) {
      h = 1;
      w = (h * box.height * ratio) / box.width;
    }
    // Stay inside the image horizontally.
    const room = handle === 'e' ? 1 - left : right;
    if (w > room) {
      w = room;
      h = (w * box.width) / ratio / box.height;
    }
    return { x: handle === 'e' ? left : right - w, y: clamp(cy - h / 2, 0, 1 - h), w, h };
  }
  const fixed = handle === 's' ? top : bottom;
  let h = Math.max(Math.abs(py - fixed), MIN_CROP);
  let w = (h * box.height * ratio) / box.width;
  if (w > 1) {
    w = 1;
    h = (w * box.width) / ratio / box.height;
  }
  const room = handle === 's' ? 1 - top : bottom;
  if (h > room) {
    h = room;
    w = (h * box.height * ratio) / box.width;
  }
  return { x: clamp(cx - w / 2, 0, 1 - w), y: handle === 's' ? top : bottom - h, w, h };
}
