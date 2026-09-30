/**
 * Derives Mantine's 10-shade color array and the editor's own
 * `--editor-accent` / `--editor-accent-soft` pair from a single
 * host-supplied accent color (EditorRootProps.accentColor). No color
 * library needed — a few lines of hex parsing plus RGB lerp is enough for a
 * usable (not professionally calibrated) ramp.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses a `#rgb` or `#rrggbb` hex color. Returns null for anything else —
 * callers fall back to the static default tokens rather than throwing on a
 * bad host-supplied value. */
export function hexToRgb(hex: string): Rgb | null {
  const cleaned = hex.trim().replace(/^#/, '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Linear-interpolates two colors; t=0 -> a, t=1 -> b. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Mantine's color-tuple shape: exactly 10 shades. */
export type AccentShades = readonly [string, string, string, string, string, string, string, string, string, string];

/**
 * A 10-shade Mantine color array for `theme.colors.likhariAccent`, mixing
 * the base color towards white for the lighter shades (0-4ish) and towards
 * black for the darker ones (6-9ish) — shade 6 (Mantine's default "filled"
 * shade) is the exact input color, matching what the static
 * `likhariAccent` ramp already did for the default tokens.
 */
export function generateAccentShades(hex: string): AccentShades | null {
  const base = hexToRgb(hex);
  if (!base) return null;
  // How far to mix towards white (positive) or black (negative) per shade,
  // relative to shade 6 = the exact input color.
  const mixAmount = [0.88, 0.72, 0.56, 0.4, 0.22, 0.1, 0, -0.14, -0.28, -0.42] as const;
  const shades = mixAmount.map((t) => rgbToHex(mix(base, t >= 0 ? WHITE : BLACK, Math.abs(t))));
  return shades as unknown as AccentShades;
}

/**
 * The editor canvas/toolbar's own `--editor-accent` / `--editor-accent-soft`
 * pair for a host-supplied accent color, mirroring the relationship between
 * `LIGHT_TOKENS`/`DARK_TOKENS`'s `accent`/`accentSoft` (packages/core/src/theme/tokens.ts):
 * light mode keeps the accent as given and derives a light tint for "soft";
 * dark mode lightens the accent itself (for contrast against a dark canvas)
 * and derives a dark tint for "soft".
 */
export function generateAccentCssVars(hex: string, mode: 'light' | 'dark'): { accent: string; accentSoft: string } | null {
  const base = hexToRgb(hex);
  if (!base) return null;
  if (mode === 'dark') {
    return {
      accent: rgbToHex(mix(base, WHITE, 0.45)),
      accentSoft: rgbToHex(mix(base, BLACK, 0.75)),
    };
  }
  return {
    accent: hex,
    accentSoft: rgbToHex(mix(base, WHITE, 0.88)),
  };
}
