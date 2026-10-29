import { describe, expect, it } from 'vitest';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $setSelection,
  createEditor,
  type LexicalEditor,
} from 'lexical';
import { $selectionIsWithinWord, type WordAtPoint } from './spellingMenu';

function makeEditor(): LexicalEditor {
  const editor = createEditor({ onError: (error) => { throw error; } });
  editor.setRootElement(document.createElement('div'));
  return editor;
}

/** A 'wrold' WordAtPoint spanning offsets [from, to) of `key`, as $wordAtDomPoint would build it. */
function wordAt(key: string, from: number, to: number): WordAtPoint {
  return { word: 'wrold', direction: 'ltr', match: { anchorKey: key, anchorOffset: from, focusKey: key, focusOffset: to } };
}

describe('$selectionIsWithinWord', () => {
  it('is true for a collapsed selection (just a caret)', () => {
    const editor = makeEditor();
    let result = false;
    editor.update(
      () => {
        const text = $createTextNode('a wrold here');
        $getRoot().append($createParagraphNode().append(text));
        text.select(4, 4);
        result = $selectionIsWithinWord(wordAt(text.getKey(), 2, 7));
      },
      { discrete: true },
    );
    expect(result).toBe(true);
  });

  it('is true when the selection exactly matches the word', () => {
    const editor = makeEditor();
    let result = false;
    editor.update(
      () => {
        const text = $createTextNode('a wrold here');
        $getRoot().append($createParagraphNode().append(text));
        text.select(2, 7);
        result = $selectionIsWithinWord(wordAt(text.getKey(), 2, 7));
      },
      { discrete: true },
    );
    expect(result).toBe(true);
  });

  it('is true when the selection sits strictly inside the word', () => {
    const editor = makeEditor();
    let result = false;
    editor.update(
      () => {
        const text = $createTextNode('a wrold here');
        $getRoot().append($createParagraphNode().append(text));
        text.select(3, 5);
        result = $selectionIsWithinWord(wordAt(text.getKey(), 2, 7));
      },
      { discrete: true },
    );
    expect(result).toBe(true);
  });

  it('is false when the selection reaches past the end of the word', () => {
    const editor = makeEditor();
    let result = true;
    editor.update(
      () => {
        const text = $createTextNode('a wrold here');
        $getRoot().append($createParagraphNode().append(text));
        text.select(2, 12); // 'wrold here'
        result = $selectionIsWithinWord(wordAt(text.getKey(), 2, 7));
      },
      { discrete: true },
    );
    expect(result).toBe(false);
  });

  it('is false when the selection reaches before the start of the word', () => {
    const editor = makeEditor();
    let result = true;
    editor.update(
      () => {
        const text = $createTextNode('a wrold here');
        $getRoot().append($createParagraphNode().append(text));
        text.select(0, 7); // 'a wrold'
        result = $selectionIsWithinWord(wordAt(text.getKey(), 2, 7));
      },
      { discrete: true },
    );
    expect(result).toBe(false);
  });

  it('is false when the selection spans a different text node entirely', () => {
    const editor = makeEditor();
    let result = true;
    editor.update(
      () => {
        const a = $createTextNode('wrold');
        const b = $createTextNode(' here');
        $getRoot().append($createParagraphNode().append(a, b));
        const selection = $createRangeSelection();
        selection.anchor.set(a.getKey(), 0, 'text');
        selection.focus.set(b.getKey(), 5, 'text');
        $setSelection(selection);
        result = $selectionIsWithinWord(wordAt(a.getKey(), 0, 5));
      },
      { discrete: true },
    );
    expect(result).toBe(false);
  });
});
