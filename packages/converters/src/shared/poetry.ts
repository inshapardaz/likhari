/**
 * Poetry block settings shared by the HTML and Markdown converters. The CSS
 * values mirror the editor's own (packages/react/src/theme/editor.css), so an
 * exported page looks the same outside the editor.
 */

/** The five layout choices, folded into one flat set (lexical-editor-spec.md
 * §4.11, amended): single/two-column/staggered are 2-line couplets;
 * musaddas (6) and mukhammas (5) render the same flat single-column shape
 * as `single`, just with a larger stanza. */
export const POETRY_LAYOUTS = ['single', 'two-column', 'staggered', 'musaddas', 'mukhammas'] as const;
export type PoetryLayout = (typeof POETRY_LAYOUTS)[number];

export const POETRY_STANZA_SIZE: Record<PoetryLayout, number> = {
  single: 2,
  'two-column': 2,
  staggered: 2,
  musaddas: 6,
  mukhammas: 5,
};

/** The layouts that render as a flat single-column stack of paragraphs —
 * the only shapes `autoWidth` (fit-content) is valid for (a percentage
 * width inside a fit-content parent is circular, so `two-column`/
 * `staggered` are excluded). Mirrors packages/react/src/blocks/PoetryNode.tsx's
 * own SINGLE_COLUMN_SHAPED_LAYOUTS. */
export const SINGLE_COLUMN_SHAPED_LAYOUTS = new Set<PoetryLayout>(['single', 'musaddas', 'mukhammas']);

/** How many couplets share one side before `staggered` flips (request 3);
 * `1` reproduces the original fixed alternation. */
export const POETRY_STAGGER_GROUPS = [1, 2] as const;
export type PoetryStaggerGroup = (typeof POETRY_STAGGER_GROUPS)[number];

/** Secondary stanza grouping, musaddas/mukhammas only (lexical-editor-spec.md
 * §4.11, amended) — mirrors packages/react/src/blocks/PoetryNode.tsx's own
 * POETRY_STANZA_VARIANTS. `continuous` is the default/original flat stanza
 * shape; `split` is the same flat shape with an extra CSS divider; `mixed`
 * is a real shape change (2 two-column rows + trailing flat paragraphs),
 * which both the HTML and Markdown converters round-trip generically
 * through the node's own children (no dedicated mixed-shape syntax needed —
 * each child already carries its own type, `layout-container` or
 * `paragraph`). */
export const POETRY_STANZA_VARIANTS = ['continuous', 'split', 'mixed'] as const;
export type PoetryStanzaVariant = (typeof POETRY_STANZA_VARIANTS)[number];
export const STANZA_VARIANT_LAYOUTS = new Set<PoetryLayout>(['musaddas', 'mukhammas']);

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

/** `stanzaVariant` only has meaning for musaddas/mukhammas — every other
 * layout always reads back `'continuous'`, same gating as PoetryNode.tsx's
 * own normalizeStanzaVariant. */
export function stanzaVariantOrDefault(value: unknown, layout: PoetryLayout): PoetryStanzaVariant {
  if (!STANZA_VARIANT_LAYOUTS.has(layout)) return 'continuous';
  return POETRY_STANZA_VARIANTS.find((name) => name === value) ?? 'continuous';
}
