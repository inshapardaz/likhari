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

/** How fonts are applied: per selection (`'selective'`) or editor-wide (`'uniform'`). */
export type FontMode = 'selective' | 'uniform';

/** Zoom levels offered in `uniform` mode, as percentages of the normal text size. */
export const ZOOM_LEVELS_PERCENT = [50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300];
export const ZOOM_MIN_PERCENT = ZOOM_LEVELS_PERCENT[0];
export const ZOOM_MAX_PERCENT = ZOOM_LEVELS_PERCENT[ZOOM_LEVELS_PERCENT.length - 1];
export const ZOOM_DEFAULT_PERCENT = 100;

/** Keeps a zoom percentage inside the supported range; non-numbers become 100. */
export function clampZoom(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return ZOOM_DEFAULT_PERCENT;
  return Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, Math.round(value)));
}

/**
 * What the canvas renders when text has no explicit font style — kept in sync
 * with `.likhari-content-editable` in theme/editor.css. The toolbar's font
 * dropdowns show these as the pre-selected values.
 */
export const CANVAS_FONT_DEFAULTS = {
  ltr: { family: DEFAULT_FONT_OPTIONS[0].family, size: '15px' },
  rtl: { family: `"Noto Nastaliq Urdu", serif`, size: '20px' },
} as const;
