/**
 * Poetry block settings shared by the HTML and Markdown converters. The CSS
 * values mirror the editor's own (packages/react/src/theme/editor.css), so an
 * exported page looks the same outside the editor.
 */

export const POETRY_LAYOUTS = ['single', 'two-column', 'staggered'] as const;
export type PoetryLayout = (typeof POETRY_LAYOUTS)[number];

export const POETRY_SCALE_NAMES = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type PoetryScaleName = (typeof POETRY_SCALE_NAMES)[number];

export const POETRY_COUPLET_GAP: Record<PoetryScaleName, string> = {
  compact: '0.4em',
  normal: '1em',
  relaxed: '1.8em',
  loose: '2.8em',
};

export const POETRY_GUTTER_PX: Record<PoetryScaleName, number> = {
  compact: 8,
  normal: 20,
  relaxed: 32,
  loose: 48,
};

export const POETRY_STAGGER_WIDTH: Record<PoetryScaleName, string> = {
  compact: '50%',
  normal: '65%',
  relaxed: '75%',
  loose: '85%',
};

/** Centered-couplet width, as a share of the block (issue #27) — 'normal' keeps the original fixed 60%. */
export const POETRY_CENTER_WIDTH: Record<PoetryScaleName, string> = {
  compact: '45%',
  normal: '60%',
  relaxed: '72%',
  loose: '85%',
};

export const POETRY_RULE = '1px dashed #8a8880';

export function scaleOrDefault(value: unknown): PoetryScaleName {
  return POETRY_SCALE_NAMES.find((name) => name === value) ?? 'normal';
}

export function layoutOrDefault(value: unknown): PoetryLayout {
  return POETRY_LAYOUTS.find((name) => name === value) ?? 'single';
}
