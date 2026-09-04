/**
 * EditorFeatureConfig — the single nested config object every plugin reads from.
 * Mirrors lexical-editor-spec.md §5 verbatim: a feature's toggle controls
 * toolbar/insert *availability*, not node registration (see
 * editor-architecture-design.md §2) — all custom node types stay registered
 * regardless of this config.
 */
export interface EditorFeatureConfig {
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    superscript?: boolean;
    subscript?: boolean;
    /** uppercase/lowercase/capitalize — one-shot text transforms, not format flags */
    caseTransforms?: boolean;
    clearFormatting?: boolean;
  };
  lists?: { numbered?: boolean; bullet?: boolean; check?: boolean };
  blocks?: {
    headingLevels?: (1 | 2 | 3 | 4 | 5 | 6)[];
    quote?: boolean;
    horizontalRule?: boolean;
    pageBreak?: boolean;
  };
  alignment?: { left?: boolean; right?: boolean; center?: boolean; justify?: boolean; start?: boolean };
  indent?: boolean;
  font?: { family?: boolean; size?: boolean; scope?: 'selection' | 'document' | 'both' };
  color?: { foreground?: boolean; background?: boolean; palette?: string[] };
  /** undo/redo */
  history?: boolean;
  links?: boolean;
  images?: { linked?: boolean; embedded?: boolean; caption?: boolean; maxSizeMB?: number };
  tables?: boolean;
  columns?: boolean;
  footnotes?: boolean;
  poetry?: { enabled?: boolean; defaultLayout?: 'single' | 'two-column' };
  findReplace?: boolean;
  language?: {
    spellCheck?: boolean;
    thesaurus?: boolean;
    autocomplete?: boolean;
    autocorrect?: boolean;
    textCleanup?: boolean;
  };
  formats?: { markdown?: boolean; html?: boolean; plainText?: boolean; lexicalJson?: boolean };
}

/** A config with every optional field resolved — what plugins actually read. */
export type ResolvedEditorFeatureConfig = Required<{
  [K in keyof EditorFeatureConfig]: EditorFeatureConfig[K] extends object | undefined
    ? Required<NonNullable<EditorFeatureConfig[K]>>
    : NonNullable<EditorFeatureConfig[K]>;
}>;

export const FULL_FEATURE_CONFIG: ResolvedEditorFeatureConfig = {
  formatting: {
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    superscript: true,
    subscript: true,
    caseTransforms: true,
    clearFormatting: true,
  },
  lists: { numbered: true, bullet: true, check: true },
  blocks: {
    headingLevels: [1, 2, 3, 4, 5, 6],
    quote: true,
    horizontalRule: true,
    pageBreak: true,
  },
  alignment: { left: true, right: true, center: true, justify: true, start: true },
  indent: true,
  font: { family: true, size: true, scope: 'both' },
  color: {
    foreground: true,
    background: true,
    palette: ['#2B6E6E', '#B3462C', '#6B4E71', '#1E1E1C', '#5C5A54'],
  },
  history: true,
  links: true,
  images: { linked: true, embedded: true, caption: true, maxSizeMB: 5 },
  tables: true,
  columns: true,
  footnotes: true,
  poetry: { enabled: true, defaultLayout: 'single' },
  findReplace: true,
  language: {
    spellCheck: true,
    thesaurus: true,
    autocomplete: true,
    autocorrect: true,
    textCleanup: true,
  },
  formats: { markdown: true, html: true, plainText: true, lexicalJson: true },
};

/** Bare minimum: paragraphs, plain text in/out, undo/redo. No formatting chrome at all. */
export const MINIMAL_FEATURE_CONFIG: EditorFeatureConfig = {
  formatting: {},
  lists: {},
  blocks: { headingLevels: [] },
  alignment: {},
  indent: false,
  font: {},
  color: {},
  history: true,
  links: false,
  images: {},
  tables: false,
  columns: false,
  footnotes: false,
  poetry: { enabled: false },
  findReplace: false,
  language: {},
  formats: { plainText: true, lexicalJson: true },
};

/** Common document editing, no verse/columns/footnotes/table extras. */
export const STANDARD_FEATURE_CONFIG: EditorFeatureConfig = {
  formatting: {
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    clearFormatting: true,
  },
  lists: { numbered: true, bullet: true, check: true },
  blocks: { headingLevels: [1, 2, 3], quote: true, horizontalRule: true },
  // Left/right stay off by default — the mockup's primary toolbar only shows
  // logical start/center/end/justify; literal side overrides are a poetry-mode
  // affordance (spec §3.2, §4.11), not a general-editing control.
  alignment: { center: true, justify: true, start: true },
  indent: true,
  font: {},
  color: {},
  history: true,
  links: true,
  images: { linked: true, embedded: true, caption: true },
  tables: false,
  columns: false,
  footnotes: false,
  poetry: { enabled: false },
  findReplace: true,
  language: {},
  formats: { markdown: true, plainText: true, lexicalJson: true },
};

/** Standard, plus poetry mode on and Urdu/Punjabi-oriented defaults. */
export const POETRY_FEATURE_CONFIG: EditorFeatureConfig = {
  ...STANDARD_FEATURE_CONFIG,
  // Literal left/right overrides matter here: per-couplet alignment override
  // is one of the four poetry templates (spec §4.11), independent of the
  // block's logical direction.
  alignment: { ...STANDARD_FEATURE_CONFIG.alignment, left: true, right: true },
  poetry: { enabled: true, defaultLayout: 'single' },
};

export const FEATURE_CONFIG_PRESETS = {
  minimal: MINIMAL_FEATURE_CONFIG,
  standard: STANDARD_FEATURE_CONFIG,
  full: FULL_FEATURE_CONFIG,
  poetry: POETRY_FEATURE_CONFIG,
} as const satisfies Record<string, EditorFeatureConfig>;

export type FeatureConfigPresetName = keyof typeof FEATURE_CONFIG_PRESETS;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merges override onto base; arrays and primitives replace, objects merge key-by-key. */
function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown> | undefined): T {
  if (!override) return base;
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    const baseValue = result[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(overrideValue)
        ? deepMerge(baseValue, overrideValue)
        : overrideValue;
  }
  return result as T;
}

/**
 * Everything off — the merge base for resolveFeatureConfig. A preset that
 * omits a sub-field (e.g. minimal's `formatting: {}`) means "off", not
 * "inherit the default": merging onto FULL_FEATURE_CONFIG directly would
 * leave those omitted booleans at their (true) default instead, since
 * deepMerge only touches keys the override actually specifies.
 */
const ALL_OFF_FEATURE_CONFIG: ResolvedEditorFeatureConfig = {
  formatting: {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    caseTransforms: false,
    clearFormatting: false,
  },
  lists: { numbered: false, bullet: false, check: false },
  blocks: { headingLevels: [], quote: false, horizontalRule: false, pageBreak: false },
  alignment: { left: false, right: false, center: false, justify: false, start: false },
  indent: false,
  font: { family: false, size: false, scope: 'selection' },
  color: { foreground: false, background: false, palette: [] },
  history: false,
  links: false,
  images: { linked: false, embedded: false, caption: false, maxSizeMB: 0 },
  tables: false,
  columns: false,
  footnotes: false,
  poetry: { enabled: false, defaultLayout: 'single' },
  findReplace: false,
  language: {
    spellCheck: false,
    thesaurus: false,
    autocomplete: false,
    autocorrect: false,
    textCleanup: false,
  },
  formats: { markdown: false, html: false, plainText: false, lexicalJson: false },
};

/**
 * Resolves a (possibly partial) EditorFeatureConfig into one with every field
 * present, starting from "everything off", layering the named preset
 * (default: 'full') on top, then the caller's own overrides.
 */
export function resolveFeatureConfig(
  config?: EditorFeatureConfig,
  preset: FeatureConfigPresetName = 'full',
): ResolvedEditorFeatureConfig {
  const base = deepMerge(ALL_OFF_FEATURE_CONFIG, FEATURE_CONFIG_PRESETS[preset] as Record<string, unknown>);
  return deepMerge(base, config as Record<string, unknown> | undefined) as ResolvedEditorFeatureConfig;
}
