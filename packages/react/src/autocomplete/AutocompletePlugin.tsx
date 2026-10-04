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
import { getDictionaryWords, type SpellLanguage } from '../spellcheck/spellDictionaries';
import { acceptedWords, onSpellWordsChange } from '../spellcheck/userWords';
import { WordIndex } from './wordIndex';

/** The letters at the end of the text before the caret. */
const WORD_END = /[\p{L}\p{M}]+$/u;
const LETTER = /[\p{L}\p{M}]/u;
/** Suggestions only appear once the typed part of a word is this long. */
const MIN_PREFIX = 2;

interface Popup {
  items: string[];
  index: number;
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
export function AutocompletePlugin({ label }: { label: string }) {
  const [editor] = useLexicalComposerContext();
  const [popup, setPopup] = useState<Popup | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const typing = useRef(false);
  const indexes = useRef(new Map<SpellLanguage, Promise<WordIndex>>());

  const show = (next: Popup | null) => {
    popupRef.current = next;
    setPopup(next);
  };

  useEffect(() => {
    const indexFor = (language: SpellLanguage): Promise<WordIndex> | null => {
      let index = indexes.current.get(language);
      if (!index) {
        const words = getDictionaryWords(language);
        if (!words) return null;
        index = words.then((dictionary) => new WordIndex([...dictionary, ...acceptedWords(language)]));
        indexes.current.set(language, index);
      }
      return index;
    };

    const hide = () => show(null);

    const refresh = () => {
      if (!typing.current) return hide();
      let target = null as { prefix: string; language: SpellLanguage; dir: 'ltr' | 'rtl' } | null;
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
        const rtl = node.getParentOrThrow().getDirection() === 'rtl';
        target = { prefix, language: rtl ? 'ur' : 'en', dir: rtl ? 'rtl' : 'ltr' };
      });
      if (target === null) return hide();
      const { prefix, language, dir } = target;
      const index = indexFor(language);
      if (!index) return hide();
      void index.then((loaded) => {
        const items = loaded.complete(prefix);
        if (items.length === 0) return hide();
        const rect = caretRect(editor);
        show({ items, index: 0, x: rect.left, y: rect.bottom, dir });
      });
    };

    const move = (delta: 1 | -1) => {
      const current = popupRef.current;
      if (!current) return false;
      const count = current.items.length;
      show({ ...current, index: (current.index + delta + count) % count });
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && popupRef.current) {
        event.preventDefault();
        show(null);
        return;
      }
      // Printable keys and Backspace are typing; any other key (arrows, Home, ...) moves the caret.
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
        (event: KeyboardEvent | null) => acceptHighlighted(event),
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
