/**
 * Poetry block settings shared by the HTML and Markdown converters. The CSS
 * values mirror the editor's own (packages/react/src/theme/editor.css), so an
 * exported page looks the same outside the editor.
 */

export const POETRY_LAYOUTS = ['single', 'two-column', 'staggered'] as const;
export type PoetryLayout = (typeof POETRY_LAYOUTS)[number];

/** The verse form — how many misra lines make up one stanza
 * (lexical-editor-spec.md §4.11, amended). `two-column`/`staggered` stay
 * couplet-only; mukhammas/musaddas only ever render `single`. */
export const POETRY_FORMS = ['couplet', 'mukhammas', 'musaddas'] as const;
export type PoetryForm = (typeof POETRY_FORMS)[number];
export const POETRY_STANZA_SIZE: Record<PoetryForm, number> = { couplet: 2, mukhammas: 5, musaddas: 6 };

/** How many couplets share one side before `staggered` flips (request 3);
 * `1` reproduces the original fixed alternation. */
export const POETRY_STAGGER_GROUPS = [1, 2] as const;
export type PoetryStaggerGroup = (typeof POETRY_STAGGER_GROUPS)[number];

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

export function formOrDefault(value: unknown): PoetryForm {
  return POETRY_FORMS.find((name) => name === value) ?? 'couplet';
}

/** Parses a boolean that may have come through as a literal boolean (Lexical
 * JSON) or the string `"true"`/`"false"` (an HTML/Markdown attribute). */
export function boolOrDefault(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function staggerGroupOrDefault(value: unknown): PoetryStaggerGroup {
  return Number(value) === 2 ? 2 : 1;
}
