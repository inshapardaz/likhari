import { DARK_TOKENS, LIGHT_TOKENS, tokensToCssVars } from './tokens';

/**
 * A ready-to-inject CSS string defining `--editor-*` custom properties for
 * light and dark mode. Used by @likhari/react's default theme provider and
 * available standalone for Web Component / non-React consumers (spec §10)
 * who can't pass a Mantine theme object directly.
 */
export function buildThemeCss(selector = ':root'): string {
  return `
${selector} {
  ${tokensToCssVars(LIGHT_TOKENS)}
}

${selector}[data-editor-color-scheme='dark'] {
  ${tokensToCssVars(DARK_TOKENS)}
}

@media (prefers-color-scheme: dark) {
  ${selector}:not([data-editor-color-scheme='light']) {
    ${tokensToCssVars(DARK_TOKENS)}
  }
}
`.trim();
}
