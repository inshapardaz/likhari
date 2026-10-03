import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $correctWordBeforeCaret } from './autoCorrectActions';
import { loadAutoCorrections, type AutoCorrectStore } from './autoCorrectStores';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';

/** Keys that end a word: a space or punctuation, in Latin and Arabic-script forms. */
const BOUNDARY_KEYS = new Set([' ', '.', ',', ';', ':', '!', '?', '،', '؛', '؟', '۔']);
const LANGUAGES: SpellLanguage[] = ['en', 'ur', 'pa-shahmukhi'];

/**
 * Corrects typed words as the user finishes them, the way the reference editor
 * does, but from any set of stores. Corrections are loaded once per change
 * of `stores` or `version` (bump `version` after saving a new correction so
 * the table reloads). The table used depends on the block's direction: RTL
 * blocks use the Urdu and Shahmukhi tables, LTR blocks the English one.
 */
export function AutoCorrectPlugin({ stores, version, enabled }: { stores: AutoCorrectStore[]; version: number; enabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  const tables = useRef(new Map<SpellLanguage, Map<string, string>>());

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    Promise.all(LANGUAGES.map(async (language) => [language, await loadAutoCorrections(stores, language)] as const)).then((loaded) => {
      if (!active) return;
      tables.current = new Map(loaded);
    });
    return () => {
      active = false;
    };
  }, [stores, version, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const tableFor = (rtl: boolean): Map<string, string> | undefined => {
      const language: SpellLanguage = rtl ? 'ur' : 'en';
      return tables.current.get(language);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || !BOUNDARY_KEYS.has(event.key)) return;
      // The character is inserted after this event; correct the word once it is there.
      setTimeout(() => {
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const block = selection.anchor.getNode().getTopLevelElement();
            const table = tableFor(block?.getDirection() === 'rtl');
            if (table) $correctWordBeforeCaret(table);
          },
          { discrete: true },
        );
      }, 0);
    };

    let root: HTMLElement | null = null;
    const attach = (next: HTMLElement | null) => {
      root?.removeEventListener('keydown', onKeyDown);
      root = next;
      root?.addEventListener('keydown', onKeyDown);
    };
    const unregister = editor.registerRootListener((next) => attach(next));
    return () => {
      unregister();
      attach(null);
    };
  }, [editor, enabled]);

  return null;
}
