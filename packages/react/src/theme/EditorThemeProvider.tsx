import { MantineProvider, type MantineThemeOverride } from '@mantine/core';
import '@mantine/core/styles.css';
import { buildThemeCss } from '@likhari/core';
import { defaultMantineTheme } from './mantineTheme';
import './editor.css';

let cssInjected = false;

// Scopes the --editor-* variables to the wrapper div below, which is what
// actually carries `data-editor-color-scheme` per instance — buildThemeCss's
// default (':root') would only work if that attribute were on <html>, which
// it isn't, so a light/dark toggle would silently do nothing (and any OS
// dark preference would win unconditionally via the media-query fallback).
const THEME_SCOPE_SELECTOR = '.likhari-theme-scope';

/** Injects the --editor-* custom property block into <head> exactly once per page. */
function useThemeCssInjection() {
  if (typeof document !== 'undefined' && !cssInjected) {
    const style = document.createElement('style');
    style.setAttribute('data-likhari-theme', '');
    style.textContent = buildThemeCss(THEME_SCOPE_SELECTOR);
    document.head.appendChild(style);
    cssInjected = true;
  }
}

export interface EditorThemeProviderProps {
  theme?: MantineThemeOverride;
  colorScheme?: 'light' | 'dark';
  children: React.ReactNode;
}

export function EditorThemeProvider({ theme, colorScheme, children }: EditorThemeProviderProps) {
  useThemeCssInjection();
  return (
    // display: contents keeps this wrapper out of the layout tree — CSS
    // custom properties still cascade to children through it (inheritance
    // doesn't depend on layout), but it doesn't sit between EditorRoot's own
    // element and the host's actual parent, so EditorRoot's `height` prop
    // (e.g. '100%') resolves against the host's container as if this div
    // weren't there at all.
    <div className="likhari-theme-scope" data-editor-color-scheme={colorScheme} style={{ display: 'contents' }}>
      <MantineProvider theme={theme ?? defaultMantineTheme}>{children}</MantineProvider>
    </div>
  );
}
