import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, type LexicalCommand } from 'lexical';
import { $correctDocument, $correctWordBeforeCaret } from './autoCorrectActions';
import { loadAutoCorrections, type AutoCorrectStore } from './autoCorrectStores';
import { normalizeUrdu, type UrduNormalizationOptions } from '../normalization/urduNormalize';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';

/** Keys that end a word: a space or punctuation, in Latin and Arabic-script forms. */
/** Corrects every word in the document, e.g. after pasting or loading content. */
export const CORRECT_DOCUMENT_COMMAND: LexicalCommand<void> = createCommand('CORRECT_DOCUMENT_COMMAND');

const BOUNDARY_KEYS = new Set([' ', '.', ',', ';', ':', '!', '?', '،', '؛', '؟', '۔']);
const LANGUAGES: SpellLanguage[] = ['en', 'ur', 'pa-shahmukhi'];
const RTL_LANGUAGES: SpellLanguage[] = ['ur', 'pa-shahmukhi'];

/**
 * Corrects typed words as the user finishes them, the way the reference editor
 * does, but from any set of stores. Corrections are loaded once per change
 * of `stores` or `version` (bump `version` after saving a new correction so
 * the table reloads). The table used depends on the block's direction: RTL
 * blocks use the Urdu and Shahmukhi tables, LTR blocks the English one.
 */
export function AutoCorrectPlugin({
  stores,
  version,
  enabled,
  urduNormalization,
}: {
  stores: AutoCorrectStore[];
  version: number;
  enabled: boolean;
  /** Urdu normalisation for right-to-left text; character mapping always applies. */
  urduNormalization?: UrduNormalizationOptions;
}) {
  const [editor] = useLexicalComposerContext();
  // Effects below run once per editor, so they reach the latest options through this ref.
  const normalizeOptions = useRef(urduNormalization);
  normalizeOptions.current = urduNormalization;
  const normalizeRtl = (text: string) => normalizeUrdu(text, normalizeOptions.current);
  const tables = useRef(new Map<SpellLanguage, Map<string, string>>());
  const rtlTable = useRef(new Map<string, string>());

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    Promise.all(LANGUAGES.map(async (language) => [language, await loadAutoCorrections(stores, language)] as const)).then((loaded) => {
      if (!active) return;
      tables.current = new Map(loaded);
      // Urdu and Shahmukhi share right-to-left blocks, so both apply there; Urdu wins a clash.
      const combined = new Map<string, string>();
      for (const language of RTL_LANGUAGES) {
        for (const [from, to] of tables.current.get(language) ?? []) if (!combined.has(from)) combined.set(from, to);
      }
      rtlTable.current = combined;
    });
    return () => {
      active = false;
    };
  }, [stores, version, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return editor.registerCommand(
      CORRECT_DOCUMENT_COMMAND,
      () => {
        editor.update(
          () => {
            $correctDocument(tables.current.get('en') ?? new Map(), rtlTable.current, normalizeRtl);
          },
          { discrete: true },
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const tableFor = (rtl: boolean): Map<string, string> | undefined => (rtl ? rtlTable.current : tables.current.get('en'));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || !BOUNDARY_KEYS.has(event.key)) return;
      // The character is inserted after this event; correct the word once it is there.
      setTimeout(() => {
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const block = selection.anchor.getNode().getTopLevelElement();
            const rtl = block?.getDirection() === 'rtl';
            const table = tableFor(rtl);
            if (table) $correctWordBeforeCaret(table, rtl ? normalizeRtl : undefined);
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
