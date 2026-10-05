import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { $misspellingsInBlock, type BlockMisspelling, type Checkers } from './spellcheckActions';
import { getSpeller } from './spellDictionaries';
import { onSpellWordsChange } from './userWords';

/** The CSS Custom Highlight name; editor.css styles it as a red wavy underline. */
const HIGHLIGHT = 'likhari-spelling';
/** A block that has just come into view is checked after this long, so scrolling past it costs nothing. */
const VIEW_DELAY_MS = 2000;
/** An edit inside a visible block is checked after the typing pauses for this long. */
const TYPING_DELAY_MS = 300;

/** The top-level block (paragraph, table, list...) that holds a node, or null. */
function $topLevelKey(node: LexicalNode): string | null {
  const root = $getRoot();
  let current: LexicalNode = node;
  while (current.getParent() && !current.getParent()!.is(root)) current = current.getParent()!;
  return current.getParent() ? current.getKey() : null;
}

/**
 * Underlines misspelled words the way the browser does, without changing the
 * document. Only blocks that are in view are checked, a block a few seconds after
 * it scrolls into view, and an edit is rechecked after typing pauses. Results are
 * kept per block, so a change re-checks only the block it is in. Underlines are
 * ranges set through the CSS Custom Highlight API. In browsers without it, nothing
 * is underlined.
 */
export function SpellHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof IntersectionObserver === 'undefined') return;

    let checkers: Checkers | null = null;
    let active = true;
    const cache = new Map<string, BlockMisspelling[]>();
    const visible = new Set<string>();
    const elements = new Map<string, Element>();
    const keyOf = new Map<Element, string>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const paint = () => {
      const ranges: Range[] = [];
      for (const [key, words] of cache) {
        const block = editor.getElementByKey(key);
        if (!block || words.length === 0) continue;
        const pieces = textPieces(block);
        for (const word of words) {
          for (const piece of pieces) {
            const start = Math.max(word.start, piece.start);
            const end = Math.min(word.end, piece.end);
            if (end <= start) continue;
            const range = document.createRange();
            range.setStart(piece.node, start - piece.start);
            range.setEnd(piece.node, end - piece.start);
            ranges.push(range);
          }
        }
      }
      CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
    };

    const checkBlock = (key: string) => {
      if (!active || !checkers) return;
      const words = editor.getEditorState().read(() => {
        const node = $getNodeByKey(key);
        return $isElementNode(node) ? $misspellingsInBlock(node, checkers!) : null;
      });
      if (words === null) cache.delete(key);
      else cache.set(key, words);
      paint();
    };

    const schedule = (key: string, delay: number) => {
      clearTimeout(timers.get(key));
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          if (visible.has(key)) checkBlock(key);
        }, delay),
      );
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = keyOf.get(entry.target);
        if (key === undefined) continue;
        if (entry.isIntersecting) {
          visible.add(key);
          if (!cache.has(key)) schedule(key, VIEW_DELAY_MS);
        } else {
          visible.delete(key);
          clearTimeout(timers.get(key));
          timers.delete(key);
        }
      }
    });

    // Keeps the observer on exactly the current top-level blocks.
    const syncBlocks = (editorState = editor.getEditorState()) => {
      const current = new Map<string, Element>();
      editorState.read(() => {
        for (const block of $getRoot().getChildren()) {
          const element = editor.getElementByKey(block.getKey());
          if (element) current.set(block.getKey(), element);
        }
      });
      for (const [key, element] of elements) {
        if (current.get(key) !== element) {
          observer.unobserve(element);
          keyOf.delete(element);
          elements.delete(key);
          visible.delete(key);
          cache.delete(key);
          clearTimeout(timers.get(key));
          timers.delete(key);
        }
      }
      for (const [key, element] of current) {
        if (!elements.has(key)) {
          elements.set(key, element);
          keyOf.set(element, key);
          observer.observe(element);
        }
      }
    };

    const unregisterUpdate = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (!checkers) return;
      const dirty = new Set<string>();
      editorState.read(() => {
        for (const key of dirtyLeaves) {
          const node = $getNodeByKey(key);
          const top = node ? $topLevelKey(node) : null;
          if (top) dirty.add(top);
        }
        for (const key of dirtyElements.keys()) {
          const node = $getNodeByKey(key);
          const top = node ? $topLevelKey(node) : null;
          if (top) dirty.add(top);
        }
      });
      syncBlocks(editorState);
      for (const key of dirty) {
        if (visible.has(key)) schedule(key, TYPING_DELAY_MS);
        else cache.delete(key);
      }
      if (dirty.size > 0) paint();
    });

    const unsubscribeWords = onSpellWordsChange(() => {
      cache.clear();
      for (const key of visible) schedule(key, 0);
      paint();
    });

    Promise.all([getSpeller('en'), getSpeller('ur')]).then(async ([en, ur]) => {
      if (!active) return;
      checkers = { ltr: en ? await en : undefined, rtl: ur ? await ur : undefined };
      syncBlocks();
      for (const key of visible) if (!cache.has(key)) schedule(key, 0);
    });

    return () => {
      active = false;
      observer.disconnect();
      unregisterUpdate();
      unsubscribeWords();
      for (const timer of timers.values()) clearTimeout(timer);
      CSS.highlights.delete(HIGHLIGHT);
    };
  }, [editor]);

  return null;
}

/** The text nodes of a rendered block, with where each one starts in the block's text. */
function textPieces(block: Element): { node: Text; start: number; end: number }[] {
  const pieces: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    pieces.push({ node: text, start: offset, end: offset + text.length });
    offset += text.length;
  }
  return pieces;
}
