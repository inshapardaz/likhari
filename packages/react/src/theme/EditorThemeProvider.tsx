import { useMemo, type CSSProperties } from 'react';
import { MantineProvider, type MantineThemeOverride } from '@mantine/core';
import '@mantine/core/styles.css';
import { buildThemeCss } from '@inshapardaz/likhari-core';
import { defaultMantineTheme } from './mantineTheme';
import { generateAccentCssVars, generateAccentShades } from './accentColor';
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
  /** Overrides both Mantine's primary color and the `--editor-accent` /
   * `--editor-accent-soft` CSS variables — see EditorRootProps.accentColor. */
  accentColor?: string;
  /**
   * The id of the portal-anchor element EditorRoot renders inside
   * `.likhari-root` (see PortalTargetContext.tsx). Scopes Mantine's OWN
   * `data-mantine-color-scheme` attribute and CSS variables to that single
   * element instead of the default `document.documentElement` — without
   * this, Mantine's Modal/Menu/Select/Tooltip surfaces (background, text,
   * border colors) would always render in Mantine's global light scheme
   * regardless of `colorScheme`, since nothing ever told MantineProvider
   * which scheme to use; forcing it at `document.documentElement` instead
   * would work but would leak dark mode onto the rest of the host page and
   * collide between multiple EditorRoot instances with different schemes.
   */
  scopeElementId?: string;
  children: React.ReactNode;
}

export function EditorThemeProvider({ theme, colorScheme, accentColor, scopeElementId, children }: EditorThemeProviderProps) {
  useThemeCssInjection();

  // Mantine wants a 10-shade array; a host only supplies one color, so a
  // small local helper (accentColor.ts) mixes it towards white/black for
  // the rest of the ramp. If `theme` is ALSO supplied, its own `colors`
  // still wins for anything it explicitly sets (shallow-merged per color
  // key) — the accent override alone isn't worth a generic deep-merge here.
  const resolvedTheme: MantineThemeOverride = useMemo(() => {
    const shades = accentColor ? generateAccentShades(accentColor) : null;
    const base = shades ? { ...defaultMantineTheme, colors: { ...defaultMantineTheme.colors, likhariAccent: shades } } : defaultMantineTheme;
    if (!theme) return base;
    return { ...base, ...theme, colors: { ...base.colors, ...theme.colors } };
  }, [accentColor, theme]);

  // Inline style wins over the injected stylesheet rule (same element, same
  // specificity otherwise) — only set when accentColor is actually given,
  // so the default static tokens keep applying via the stylesheet the rest
  // of the time.
  const accentVars = accentColor ? generateAccentCssVars(accentColor, colorScheme === 'dark' ? 'dark' : 'light') : null;
  const accentStyle: CSSProperties = accentVars
    ? ({ '--editor-accent': accentVars.accent, '--editor-accent-soft': accentVars.accentSoft } as CSSProperties)
    : {};

  return (
    // display: contents keeps this wrapper out of the layout tree — CSS
    // custom properties still cascade to children through it (inheritance
    // doesn't depend on layout), but it doesn't sit between EditorRoot's own
    // element and the host's actual parent, so EditorRoot's `height` prop
    // (e.g. '100%') resolves against the host's container as if this div
    // weren't there at all.
    <div
      className="likhari-theme-scope"
      data-editor-color-scheme={colorScheme}
      style={{ display: 'contents', ...accentStyle }}
    >
      <MantineProvider
        theme={resolvedTheme}
        forceColorScheme={colorScheme}
        defaultColorScheme="auto"
        getRootElement={scopeElementId ? () => document.getElementById(scopeElementId) ?? undefined : undefined}
        cssVariablesSelector={scopeElementId ? `#${CSS.escape(scopeElementId)}` : undefined}
      >
        {children}
      </MantineProvider>
    </div>
  );
}
