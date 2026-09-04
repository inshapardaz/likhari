import { MantineProvider, type MantineThemeOverride } from '@mantine/core';
import '@mantine/core/styles.css';
import { buildThemeCss } from '@likhari/core';
import { defaultMantineTheme } from './mantineTheme';
import './editor.css';

let cssInjected = false;

/** Injects the --editor-* custom property block into <head> exactly once per page. */
function useThemeCssInjection() {
  if (typeof document !== 'undefined' && !cssInjected) {
    const style = document.createElement('style');
    style.setAttribute('data-likhari-theme', '');
    style.textContent = buildThemeCss();
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
    <div data-editor-color-scheme={colorScheme}>
      <MantineProvider theme={theme ?? defaultMantineTheme}>{children}</MantineProvider>
    </div>
  );
}
