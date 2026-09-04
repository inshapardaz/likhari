/**
 * Design tokens from editor-ui-design-spec.md §2. Consumed both as plain JS
 * values (Mantine theme mapping in @likhari/react) and re-exported as CSS
 * custom properties (theme.css) for non-React / Web Component consumers.
 */
export interface ColorTokens {
  paper: string;
  paperDim: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentSoft: string;
  poetry: string;
  danger: string;
}

export const LIGHT_TOKENS: ColorTokens = {
  paper: '#F6F5F2',
  paperDim: '#EDEBE6',
  ink: '#1E1E1C',
  inkSoft: '#5C5A54',
  line: '#DAD7CE',
  lineStrong: '#BEBAAE',
  accent: '#2B6E6E',
  accentSoft: '#E4EFEE',
  poetry: '#6B4E71',
  danger: '#B3462C',
};

export const DARK_TOKENS: ColorTokens = {
  paper: '#1B1B19',
  paperDim: '#242422',
  ink: '#EDEBE4',
  inkSoft: '#A6A398',
  line: '#3A3934',
  lineStrong: '#4E4C45',
  accent: '#6FBFBF',
  accentSoft: '#233333',
  poetry: '#C79ECB',
  danger: '#E08A73',
};

/** Canvas type scale, editor-ui-design-spec.md §4 — do not share one value across scripts. */
export const TYPE_SCALE = {
  latin: {
    fontFamily: `'IBM Plex Serif', Georgia, serif`,
    body: { fontSize: '15px', lineHeight: 1.75 },
    h1: { fontSize: '1.8em', fontWeight: 600 },
    h2: { fontSize: '1.5em', fontWeight: 600 },
    h3: { fontSize: '1.3em', fontWeight: 600 },
    h4: { fontSize: '1.2em', fontWeight: 600 },
    h5: { fontSize: '1.1em', fontWeight: 600 },
    h6: { fontSize: '1.05em', fontWeight: 600 },
    poetry: { fontSize: '15px', lineHeight: 1.6 },
  },
  nastaliq: {
    fontFamily: `'Noto Nastaliq Urdu', serif`,
    body: { fontSize: '20px', lineHeight: 2.3 },
    h1: { fontSize: '1.8em', fontWeight: 600 },
    h2: { fontSize: '1.5em', fontWeight: 600 },
    h3: { fontSize: '1.3em', fontWeight: 600 },
    h4: { fontSize: '1.2em', fontWeight: 600 },
    h5: { fontSize: '1.1em', fontWeight: 600 },
    h6: { fontSize: '1.05em', fontWeight: 600 },
    poetry: { fontSize: '20px', lineHeight: 2.1 },
  },
} as const;

export const CHROME_FONT_FAMILY = `'IBM Plex Sans', system-ui, sans-serif`;

export const TOOLBAR = {
  height: '46px',
  buttonSize: '30px',
  buttonGap: '8px',
  iconSize: '15px',
  labelSize: '12px',
  dividerWidth: '0.5px',
};

export const POETRY_SPACING = {
  coupletGap: '1.4em',
  paragraphGap: '1em',
};

/** Renders a ColorTokens object as `--name: value;` lines for a CSS custom-property block. */
export function tokensToCssVars(tokens: ColorTokens, prefix = '--editor-'): string {
  return Object.entries(tokens)
    .map(([key, value]) => {
      const kebab = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      return `${prefix}${kebab}: ${value};`;
    })
    .join('\n  ');
}
