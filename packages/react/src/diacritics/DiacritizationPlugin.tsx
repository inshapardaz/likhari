import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND, createCommand, type LexicalCommand } from 'lexical';
import { $correctDocument, $correctWordBeforeCaret, $correctWordEndingAtCaret, $preservingSelection } from '../autocorrect/autoCorrectActions';
import { loadDiacriticsTable, type DiacriticsStore } from './diacriticsStore';
import type { DiacriticLevel } from '../normalization/urduNormalize';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';

/** Adds diacritics to every word in the document that the table covers. */
export const ADD_DIACRITICS_COMMAND: LexicalCommand<void> = createCommand('ADD_DIACRITICS_COMMAND');

const BOUNDARY_KEYS = new Set([' ', '.', ',', ';', ':', '!', '?', '،', '؛', '؟', '۔']);
/** Diacritics apply to right-to-left blocks only: Urdu and Shahmukhi share one merged table, Urdu winning a clash. */
const RTL_LANGUAGES: SpellLanguage[] = ['ur', 'pa-shahmukhi'];

/**
 * Adds vowel marks (harakat) to right-to-left text, at the chosen `level`,
 * from a dictionary of bare-word-to-fully-vowelled-word entries. Distinct
 * from `AutoCorrectPlugin`: the bare word isn't wrong, so this never touches
 * the typo-correction dictionary or its store.
 */
export function DiacritizationPlugin({
  stores,
  level,
  enabled,
  typing,
}: {
  stores: DiacriticsStore[];
  /** How many of a word's diacritics to add. */
  level: DiacriticLevel;
  /** Whether the table and the whole-document command are active. */
  enabled: boolean;
  /** Whether words are diacritized as the user finishes typing them, not only on demand. */
  typing: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const table = useRef(new Map<string, string>());
  const loaded = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loaded.current = Promise.all(RTL_LANGUAGES.map((language) => loadDiacriticsTable(stores, language, level)))
      .then((tables) => {
        if (!active) return;
        const combined = new Map<string, string>();
        for (const t of tables) for (const [word, vowelled] of t) if (!combined.has(word)) combined.set(word, vowelled);
        table.current = combined;
      })
      .catch(() => {
        table.current = new Map();
      });
    return () => {
      active = false;
    };
  }, [stores, level, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return editor.registerCommand(
      ADD_DIACRITICS_COMMAND,
      () => {
        loaded.current.then(() => {
          editor.update(() => $preservingSelection(() => $correctDocument(new Map(), table.current)), { discrete: true });
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, enabled]);

  useEffect(() => {
    if (!enabled || !typing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key.length !== 1 || !BOUNDARY_KEYS.has(event.key)) return;
      setTimeout(() => {
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            // The word's own script picks the table (see autoCorrectActions.ts); there is no
            // left-to-right diacritics table, so an empty one leaves non-Urdu words untouched.
            $correctWordBeforeCaret(new Map(), table.current);
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
    const diacritizeEndingWord = () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;
      $correctWordEndingAtCaret(new Map(), table.current);
      return false;
    };
    const unregisterEnter = editor.registerCommand(KEY_ENTER_COMMAND, diacritizeEndingWord, COMMAND_PRIORITY_HIGH);
    const unregisterBlur = editor.registerCommand(BLUR_COMMAND, diacritizeEndingWord, COMMAND_PRIORITY_EDITOR);
    return () => {
      unregister();
      unregisterEnter();
      unregisterBlur();
      attach(null);
    };
  }, [editor, enabled, typing]);

  return null;
}
