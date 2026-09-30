import { createContext, useContext } from 'react';

/**
 * CSS selector for the portal-anchor `<div>` `EditorRoot` renders as the
 * first child of `.likhari-root` (see EditorRoot.tsx). Mantine's `Menu`,
 * `Modal`, `Select`'s combobox and `Tooltip` all default to portaling their
 * content to `document.body` — outside the DOM subtree that carries the
 * `--editor-*` CSS custom properties (`.likhari-theme-scope`) and the `dir`
 * attribute (`.likhari-root`), so none of that styling/direction reaches
 * them. Passing this selector as the target fixes that by portaling into a
 * genuine descendant of both instead.
 *
 * `undefined` (the default, outside any `EditorRoot`, or before it has
 * mounted) falls back to Mantine's own default portal behavior.
 */
export const PortalTargetContext = createContext<string | undefined>(undefined);

export function usePortalTarget(): string | undefined {
  return useContext(PortalTargetContext);
}
