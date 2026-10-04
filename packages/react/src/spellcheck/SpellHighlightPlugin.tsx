import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $collectMisspellings, type Checkers } from './spellcheckActions';
import { getSpeller } from './spellDictionaries';
import { onSpellWordsChange } from './userWords';

/** The CSS Custom Highlight name; editor.css styles it as a red wavy underline. */
const HIGHLIGHT = 'likhari-spelling';
const DEBOUNCE_MS = 300;

/**
 * Underlines misspelled words the way the browser does, without changing the
 * document: ranges are set on the rendered text through the CSS Custom
 * Highlight API. Checking is debounced so typing stays smooth. In browsers
 * without the API, nothing is underlined.
 */
export function SpellHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;

    let checkers: Checkers | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const paint = () => {
      if (!active || !checkers) return;
      const found = editor.getEditorState().read(() => $collectMisspellings(checkers!));
      const ranges: Range[] = [];
      for (const misspelling of found) {
        for (const segment of misspelling.segments) {
          const text = editor.getElementByKey(segment.key)?.firstChild;
          if (!text || text.nodeType !== Node.TEXT_NODE) continue;
          const range = document.createRange();
          range.setStart(text, segment.start);
          range.setEnd(text, segment.end);
          ranges.push(range);
        }
      }
      CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(paint, DEBOUNCE_MS);
    };

    const unregister = editor.registerUpdateListener(schedule);
    const unsubscribe = onSpellWordsChange(schedule);

    Promise.all([getSpeller('en'), getSpeller('ur')]).then(async ([en, ur]) => {
      checkers = { ltr: en ? await en : undefined, rtl: ur ? await ur : undefined };
      schedule();
    });

    return () => {
      active = false;
      clearTimeout(timer);
      unregister();
      unsubscribe();
      CSS.highlights.delete(HIGHLIGHT);
    };
  }, [editor]);

  return null;
}
