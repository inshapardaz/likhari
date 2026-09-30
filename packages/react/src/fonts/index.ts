import { URDU_WEB_FONT_OPTIONS, type FontOption } from './urduWebFonts';

export { URDU_WEB_FONT_OPTIONS, injectUrduWebFontsCss, type FontOption } from './urduWebFonts';

/** Three generic Latin faces plus the full urdu-web-fonts collection. */
export const DEFAULT_FONT_OPTIONS: FontOption[] = [
  { name: 'Serif', family: `'IBM Plex Serif', Georgia, serif`, group: 'Latin' },
  { name: 'Sans', family: `'IBM Plex Sans', system-ui, sans-serif`, group: 'Latin' },
  { name: 'Mono', family: `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`, group: 'Latin' },
  ...URDU_WEB_FONT_OPTIONS,
];

/** Sizes offered by the toolbar's font-size dropdown, in px. */
export const FONT_SIZES_PX = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 48];

/**
 * What the canvas renders when text has no explicit font style — kept in sync
 * with `.likhari-content-editable` in theme/editor.css. The toolbar's font
 * dropdowns show these as the pre-selected values.
 */
export const CANVAS_FONT_DEFAULTS = {
  ltr: { family: DEFAULT_FONT_OPTIONS[0].family, size: '15px' },
  rtl: { family: `"Noto Nastaliq Urdu", serif`, size: '20px' },
} as const;
