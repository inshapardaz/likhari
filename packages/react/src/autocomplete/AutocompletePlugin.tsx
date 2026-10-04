import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { $replaceMatch } from '../find/findReplaceActions';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';
import { onSpellWordsChange } from '../spellcheck/userWords';
import { WordIndex } from './wordIndex';
import type { CompletionStore } from './completionStores';

/** The letters at the end of the text before the caret. */
const WORD_END = /[\p{L}\p{M}]+$/u;
const LETTER = /[\p{L}\p{M}]/u;
const MOVEMENT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
/** Suggestions only appear once the typed part of a word is this long. */
const MIN_PREFIX = 2;

interface Popup {
  items: string[];
  index: number;
  /** Whether the user has moved into the list. Enter only accepts after that, so it still starts a new line. */
  selected: boolean;
  x: number;
  y: number;
  dir: 'ltr' | 'rtl';
}

/**
 * Suggests completions for the word being typed, from the dictionary's words and
 * the user's own. Shown only while typing, at the caret. Tab or Enter accepts the
 * highlighted suggestion, the arrow keys move through the list, and Escape (or
 * moving the caret) dismisses it. Left-to-right text uses the English dictionary,
 * right-to-left text the Urdu one.
 */
export function AutocompletePlugin({
  label,
  stores,
  language: chosenLanguage,
}: {
  label: string;
  stores: CompletionStore[];
  /** The language to complete in, or 'auto' to follow the block's direction. */
  language: SpellLanguage | 'auto';
}) {
  const [editor] = useLexicalComposerContext();
  // Effects run once per editor, so they read the latest props through refs.
  const storesRef = useRef(stores);
  storesRef.current = stores;
  const languageRef = useRef(chosenLanguage);
  languageRef.current = chosenLanguage;
  const [popup, setPopup] = useState<Popup | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const typing = useRef(false);
  const indexes = useRef(new Map<SpellLanguage, Promise<WordIndex>>());

  const show = (next: Popup | null) => {
    popupRef.current = next;
    setPopup(next);
  };

  useEffect(() => {
    const indexFor = (language: SpellLanguage): Promise<WordIndex> => {
      let index = indexes.current.get(language);
      if (!index) {
        index = Promise.all(storesRef.current.map((store) => store.load(language).catch(() => [] as string[]))).then(
          (lists) => new WordIndex(lists.flat()),
        );
        indexes.current.set(language, index);
      }
      return index;
    };

    const hide = () => show(null);

    const refresh = () => {
      if (!typing.current) return hide();
      let target = null as { prefix: string; rtl: boolean } | null;
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
        const node = selection.anchor.getNode();
        if (!$isTextNode(node)) return;
        const text = node.getTextContent();
        const before = text.slice(0, selection.anchor.offset);
        const prefix = WORD_END.exec(before)?.[0];
        const after = text.charAt(selection.anchor.offset);
        if (!prefix || prefix.length < MIN_PREFIX || (after !== '' && LETTER.test(after))) return;
        target = { prefix, rtl: node.getParentOrThrow().getDirection() === 'rtl' };
      });
      if (target === null) return hide();
      const { prefix, rtl } = target;
      const language: SpellLanguage = languageRef.current === 'auto' ? (rtl ? 'ur' : 'en') : languageRef.current;
      void indexFor(language).then((loaded) => {
        const items = loaded.complete(prefix);
        if (items.length === 0) return hide();
        const rect = caretRect(editor);
        show({ items, index: 0, selected: false, x: rect.left, y: rect.bottom, dir: rtl ? 'rtl' : 'ltr' });
      });
    };

    const move = (delta: 1 | -1) => {
      const current = popupRef.current;
      if (!current) return false;
      const count = current.items.length;
      show({ ...current, index: (current.index + delta + count) % count, selected: true });
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Up, Down, Tab and Enter act on the list through their editor commands, which
      // run after this listener, so the list must stay open for them.
      const current = popupRef.current;
      if (current && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab' || (event.key === 'Enter' && current.selected))) return;
      if (event.key === 'Escape' && popupRef.current) {
        event.preventDefault();
        show(null);
        return;
      }
      // Left, Right, Home and End move the caret away from the word, so the list closes.
      if (MOVEMENT_KEYS.has(event.key)) {
        typing.current = false;
        return hide();
      }
      // Printable keys and Backspace are typing; anything else (Enter, Tab, ...) ends the word.
      typing.current = (event.key.length === 1 && !event.ctrlKey && !event.metaKey) || event.key === 'Backspace';
      if (!typing.current) hide();
      setTimeout(refresh, 0);
    };
    const onMouseDown = () => {
      typing.current = false;
      hide();
    };

    let root: HTMLElement | null = null;
    const attach = (next: HTMLElement | null) => {
      root?.removeEventListener('keydown', onKeyDown);
      root?.removeEventListener('mousedown', onMouseDown);
      root = next;
      root?.addEventListener('keydown', onKeyDown);
      root?.addEventListener('mousedown', onMouseDown);
    };
    const unregisterRoot = editor.registerRootListener((next) => attach(next));
    const unregisterUpdate = editor.registerUpdateListener(() => {
      // Keydown already schedules a refresh; this keeps the list right after the
      // dictionary or user words change.
      if (typing.current) setTimeout(refresh, 0);
    });
    const unregisterWords = onSpellWordsChange(() => {
      indexes.current.clear();
      if (typing.current) setTimeout(refresh, 0);
    });

    const unregisterCommands = [
      editor.registerCommand(KEY_ARROW_DOWN_COMMAND, () => move(1), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ARROW_UP_COMMAND, () => move(-1), COMMAND_PRIORITY_HIGH),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event: KeyboardEvent | null) => acceptHighlighted(event),
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event: KeyboardEvent | null) => (popupRef.current?.selected ? acceptHighlighted(event) : false),
        COMMAND_PRIORITY_HIGH,
      ),
    ];

    function acceptHighlighted(event: KeyboardEvent | null): boolean {
      const current = popupRef.current;
      if (!current) return false;
      event?.preventDefault();
      acceptItem(editor, current.items[current.index]);
      show(null);
      return true;
    }

    return () => {
      unregisterRoot();
      unregisterUpdate();
      unregisterWords();
      unregisterCommands.forEach((unregister) => unregister());
      attach(null);
      show(null);
    };
  }, [editor]);

  // The index is per store set and language; a change of stores starts again.
  useEffect(() => {
    indexes.current.clear();
  }, [stores]);

  if (!popup) return null;
  return (
    <div
      className="likhari-autocomplete"
      role="listbox"
      aria-label={label}
      dir={popup.dir}
      style={{ position: 'fixed', left: popup.x, top: popup.y + 4 }}
    >
      {popup.items.map((item, i) => (
        <div
          key={item}
          role="option"
          aria-selected={i === popup.index}
          className={i === popup.index ? 'likhari-autocomplete-item likhari-autocomplete-item--active' : 'likhari-autocomplete-item'}
          onMouseDown={(event) => {
            event.preventDefault();
            acceptItem(editor, item);
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

/** Where to put the popup: under the caret, or the editor's top-left if the caret has no position yet. */
function caretRect(editor: LexicalEditor): { left: number; bottom: number } {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return { left: rect.left, bottom: rect.bottom };
  }
  const root = editor.getRootElement()?.getBoundingClientRect();
  return { left: root?.left ?? 0, bottom: root?.top ?? 0 };
}

function acceptItem(editor: LexicalEditor, item: string): void {
  editor.update(
    () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      const node = selection.anchor.getNode();
      if (!$isTextNode(node)) return;
      const before = node.getTextContent().slice(0, selection.anchor.offset);
      const prefix = WORD_END.exec(before)?.[0];
      if (!prefix) return;
      const start = before.length - prefix.length;
      $replaceMatch({ anchorKey: node.getKey(), anchorOffset: start, focusKey: node.getKey(), focusOffset: before.length }, item);
    },
    { discrete: true },
  );
  editor.focus();
}
