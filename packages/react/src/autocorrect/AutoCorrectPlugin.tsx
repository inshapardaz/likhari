import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  createCommand,
  type LexicalCommand,
} from 'lexical';
import {
  $correctDocument,
  $correctPunctuationBeforeCaret,
  $correctPunctuationDocument,
  $correctWordBeforeCaret,
  $correctWordEndingAtCaret,
  $preservingSelection,
  $spacePunctuationDocument,
} from './autoCorrectActions';
import { $cleanUpText } from '../cleanup/textCleanupActions';
import { activePunctuationRules, type PunctuationOptions, type PunctuationRule } from './punctuationRules';
import { loadAutoCorrectEntries, type AutoCorrectEntry, type AutoCorrectStore } from './autoCorrectStores';
import { normalizeUrdu, type UrduNormalizationOptions } from '../normalization/urduNormalize';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';
import { autoCorrectDebugLog } from './autoCorrectDebug';

/** Keys that end a word: a space or punctuation, in Latin and Arabic-script forms. */
/** Corrects every word in the document, e.g. after pasting or loading content. */
export const CORRECT_DOCUMENT_COMMAND: LexicalCommand<void> = createCommand('CORRECT_DOCUMENT_COMMAND');

const BOUNDARY_KEYS = new Set([' ', '.', ',', ';', ':', '!', '?', '،', '؛', '؟', '۔']);
const LANGUAGES: SpellLanguage[] = ['en', 'ur', 'pa-shahmukhi'];
const RTL_LANGUAGES: SpellLanguage[] = ['ur', 'pa-shahmukhi'];

/** The whole-word entries (the default) as a from-to table. */
function wholeWordTable(entries: AutoCorrectEntry[]): Map<string, string> {
  const table = new Map<string, string>();
  for (const entry of entries) if (entry.wholeWord !== false) table.set(entry.from, entry.to);
  return table;
}

/** Entries marked "not whole word only", as substring-matching rules, longest first. */
function substringAutoCorrectRules(entries: AutoCorrectEntry[]): PunctuationRule[] {
  return entries
    .filter((entry) => entry.wholeWord === false)
    .map((entry) => ({ incorrect: entry.from, correct: entry.to, completeWord: false }))
    .sort((a, b) => b.incorrect.length - a.incorrect.length);
}

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
  typing,
  urduNormalization,
  punctuation,
}: {
  stores: AutoCorrectStore[];
  version: number;
  /** Whether the tables and the whole-document command are active. */
  enabled: boolean;
  /** Whether corrections run as the user types (auto-correct), not only on demand. */
  typing: boolean;
  /** Urdu normalisation for right-to-left text; character mapping always applies. */
  urduNormalization?: UrduNormalizationOptions;
  /** Common punctuation fixes (from the bundled Urdu rule list). */
  punctuation?: PunctuationOptions;
}) {
  const [editor] = useLexicalComposerContext();
  // Effects below run once per editor, so they reach the latest options through this ref.
  const normalizeOptions = useRef(urduNormalization);
  normalizeOptions.current = urduNormalization;
  const punctuationRules = useRef(activePunctuationRules(punctuation));
  punctuationRules.current = activePunctuationRules(punctuation);
  const combinedRules = () =>
    [...punctuationRules.current, ...substringRules.current].sort((a, b) => b.incorrect.length - a.incorrect.length);
  const normalizeRtl = (text: string) => normalizeUrdu(text, normalizeOptions.current);
  const tables = useRef(new Map<SpellLanguage, Map<string, string>>());
  const rtlTable = useRef(new Map<string, string>());
  // Corrections marked "not whole word only" apply even inside a longer word, so they
  // run through the same substring-matching machinery as the punctuation rules.
  const substringRules = useRef<PunctuationRule[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    autoCorrectDebugLog('loading entries from', stores.length, 'store(s):', stores.map((s) => s.id));
    Promise.all(LANGUAGES.map(async (language) => [language, await loadAutoCorrectEntries(stores, language)] as const)).then((loaded) => {
      if (!active) return;
      for (const [language, entries] of loaded) autoCorrectDebugLog('loaded', entries.length, 'entries for', language);
      tables.current = new Map(loaded.map(([language, entries]) => [language, wholeWordTable(entries)]));
      // Urdu and Shahmukhi share right-to-left blocks, so both apply there; Urdu wins a clash.
      const combined = new Map<string, string>();
      for (const language of RTL_LANGUAGES) {
        for (const [from, to] of tables.current.get(language) ?? []) if (!combined.has(from)) combined.set(from, to);
      }
      rtlTable.current = combined;
      substringRules.current = loaded.flatMap(([, entries]) => substringAutoCorrectRules(entries));
      autoCorrectDebugLog(
        'tables ready: en whole-word:', tables.current.get('en')?.size ?? 0,
        'rtl whole-word:', rtlTable.current.size,
        'substring rules:', substringRules.current.length,
      );
    }).catch((error) => autoCorrectDebugLog('failed to load entries:', error));
    return () => {
      active = false;
    };
  }, [stores, version, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return editor.registerCommand(
      CORRECT_DOCUMENT_COMMAND,
      () => {
        autoCorrectDebugLog('CORRECT_DOCUMENT_COMMAND dispatched');
        editor.update(
          () => {
            $preservingSelection(() => {
              $cleanUpText();
              if (punctuation?.spacing) $spacePunctuationDocument();
              $correctPunctuationDocument(combinedRules());
              $correctDocument(tables.current.get('en') ?? new Map(), rtlTable.current, normalizeRtl);
            });
          },
          { discrete: true },
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, enabled, punctuation?.spacing]);

  useEffect(() => {
    if (!enabled || !typing) return;

    const tableFor = (rtl: boolean): Map<string, string> | undefined => (rtl ? rtlTable.current : tables.current.get('en'));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key.length !== 1) return;
      const boundary = BOUNDARY_KEYS.has(event.key);
      // The character is inserted after this event; correct once it is there.
      setTimeout(() => {
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            autoCorrectDebugLog('keydown', JSON.stringify(event.key), 'boundary:', boundary);
            // Punctuation can end in any character (e.g. the letter ه), so every key is checked.
            $correctPunctuationBeforeCaret(combinedRules());
            if (!boundary) return;
            const block = selection.anchor.getNode().getTopLevelElement();
            const rtl = block?.getDirection() === 'rtl';
            const table = tableFor(rtl);
            if (table) $correctWordBeforeCaret(table, rtl ? normalizeRtl : undefined);
            else autoCorrectDebugLog('keydown: no table for direction', rtl ? 'rtl' : 'ltr');
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
    // A word with nothing after it (end of line or document) is corrected when the
    // caret leaves it: Enter splits the line, and blur means the user has moved on.
    const correctEndingWord = () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;
      const rtl = selection.anchor.getNode().getTopLevelElement()?.getDirection() === 'rtl';
      const table = tableFor(rtl);
      if (table) $correctWordEndingAtCaret(table, rtl ? normalizeRtl : undefined);
      return false;
    };
    const unregisterEnter = editor.registerCommand(KEY_ENTER_COMMAND, correctEndingWord, COMMAND_PRIORITY_HIGH);
    const unregisterBlur = editor.registerCommand(BLUR_COMMAND, correctEndingWord, COMMAND_PRIORITY_EDITOR);
    return () => {
      unregister();
      unregisterEnter();
      unregisterBlur();
      attach(null);
    };
  }, [editor, enabled, typing]);

  return null;
}
