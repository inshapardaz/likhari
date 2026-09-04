import { createTheme, type MantineThemeOverride } from '@mantine/core';
import { LIGHT_TOKENS } from '@likhari/core';

/**
 * Default Mantine theme (headless mode, UI spec §10) — supplies structure/
 * behavior while the app's own --editor-* CSS variables (theme.css) carry
 * the actual visual tokens, so a host restyling the editor overrides CSS
 * variables rather than fighting Mantine's default visuals.
 */
export const defaultMantineTheme: MantineThemeOverride = createTheme({
  fontFamily: `'IBM Plex Sans', system-ui, sans-serif`,
  primaryColor: 'likhariAccent',
  colors: {
    likhariAccent: [
      LIGHT_TOKENS.accentSoft,
      LIGHT_TOKENS.accentSoft,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
      LIGHT_TOKENS.accent,
    ],
  },
  defaultRadius: 'sm',
});
