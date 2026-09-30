import { createContext, useContext, useMemo } from 'react';
import { getStrings, type Locale, type Strings } from './strings';

/** Returns the translated strings dictionary for `locale`. */
export function useStrings(locale: Locale): Strings {
  return useMemo(() => getStrings(locale), [locale]);
}

/** Provided once at `EditorRoot`'s top level so components that aren't
 * direct children (dialogs, context menus) can reach the current locale's
 * strings without threading a `locale` prop through every intermediate
 * component. */
export const UiStringsContext = createContext<Strings>(getStrings('en'));

export function useUiStrings(): Strings {
  return useContext(UiStringsContext);
}
