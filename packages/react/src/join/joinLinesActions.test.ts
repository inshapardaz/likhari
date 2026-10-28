import { describe, expect, it } from 'vitest';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $createRangeSelection,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  createEditor,
  type LexicalEditor,
} from 'lexical';
import { $canJoinLines, $joinSelectedLines } from './joinLinesActions';

function makeEditor(): LexicalEditor {
  const editor = createEditor({ onError: (error) => { throw error; } });
  editor.setRootElement(document.createElement('div'));
  return editor;
}

/** Each string is one paragraph; a '\n' inside it becomes a soft break. */
function setParagraphs(editor: LexicalEditor, paragraphs: string[]): void {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      for (const line of paragraphs) {
        const paragraph = $createParagraphNode();
        line.split('\n').forEach((part, index) => {
          if (index > 0) paragraph.append($createLineBreakNode());
          paragraph.append($createTextNode(part));
        });
        root.append(paragraph);
      }
    },
    { discrete: true },
  );
}

/** Sets the selection from the start of the first paragraph to the end of the last. */
function $selectAll(): void {
  const root = $getRoot();
  const first = root.getFirstDescendant();
  const last = root.getLastDescendant();
  if (!first || !last) return;
  const selection = $createRangeSelection();
  selection.anchor.set(first.getKey(), 0, 'text');
  selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
  $setSelection(selection);
}

function paragraphPlain(editor: LexicalEditor): string[] {
  return editor.getEditorState().read(() => $getRoot().getChildren().map((node) => node.getTextContent()));
}

/** Selects from the first text node to the end of the text node at `index`, then joins. */
function selectThroughTextAndJoin(editor: LexicalEditor, index: number): boolean {
  let changed = false;
  editor.update(
    () => {
      const texts = $getRoot().getAllTextNodes();
      const first = texts[0];
      const end = texts[index];
      if (!first || !end) return;
      const selection = $createRangeSelection();
      selection.anchor.set(first.getKey(), 0, 'text');
      selection.focus.set(end.getKey(), end.getTextContentSize(), 'text');
      $setSelection(selection);
      changed = $joinSelectedLines();
    },
    { discrete: true },
  );
  return changed;
}

/** The selection is set in the same update as the join: an unfocused editor drops it between updates. */
function selectAllAndJoin(editor: LexicalEditor): boolean {
  let changed = false;
  editor.update(
    () => {
      $selectAll();
      changed = $joinSelectedLines();
    },
    { discrete: true },
  );
  return changed;
}

/** One paragraph holding a single text node with literal newlines, as older plain-text imports produced. */
function setTextWithNewlines(editor: LexicalEditor, text: string): void {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      root.append(paragraph);
    },
    { discrete: true },
  );
}

describe('joinSelectedLines', () => {
  it('joins lines separated by a newline inside a text node', () => {
    const editor = makeEditor();
    setTextWithNewlines(editor, 'first\nsecond\nthird');
    let joinable = false;
    editor.update(
      () => {
        $selectAll();
        joinable = $canJoinLines();
        $joinSelectedLines();
      },
      { discrete: true },
    );
    expect(joinable).toBe(true);
    expect(paragraphPlain(editor)).toEqual(['first second third']);
  });

  it('turns a soft break into one space', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['first\nsecond']);
    expect(selectAllAndJoin(editor)).toBe(true);
    expect(paragraphPlain(editor)).toEqual(['first second']);
  });

  it('does not add a second space where one already exists', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['first \nsecond', 'third\n second']);
    selectAllAndJoin(editor);
    expect(paragraphPlain(editor)).toEqual(['first second third second']);
  });

  it('joins separate paragraphs into one, with a space between', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['alpha', 'beta', 'gamma']);
    selectAllAndJoin(editor);
    expect(paragraphPlain(editor)).toEqual(['alpha beta gamma']);
  });

  it('does nothing for a single line with no break', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['just one line']);
    expect(selectAllAndJoin(editor)).toBe(false);
    expect(paragraphPlain(editor)).toEqual(['just one line']);
  });

  it('turns the soft break after the selection into a paragraph break', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['L1\nL2\nL3\nL4']);
    expect(selectThroughTextAndJoin(editor, 1)).toBe(true);
    expect(paragraphPlain(editor)).toEqual(['L1 L2', 'L3\nL4']);
  });

  it('keeps the joined paragraph separate from the paragraph after it', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['alpha', 'beta\ngamma', 'delta']);
    expect(selectThroughTextAndJoin(editor, 1)).toBe(true);
    expect(paragraphPlain(editor)).toEqual(['alpha beta', 'gamma', 'delta']);
  });

  it('reports joinable only when the selection spans more than one line', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['one', 'two']);
    let joinable = false;
    editor.update(
      () => {
        $selectAll();
        joinable = $canJoinLines();
      },
      { discrete: true },
    );
    expect(joinable).toBe(true);
  });

  it('leaves the unselected rest of a partly-selected last paragraph as its own paragraph', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['abc', 'defghi']);
    // Select from the start of 'abc' through 'def' in the second paragraph, leaving 'ghi' unselected.
    editor.update(
      () => {
        const texts = $getRoot().getAllTextNodes();
        const selection = $createRangeSelection();
        selection.anchor.set(texts[0]!.getKey(), 0, 'text');
        selection.focus.set(texts[1]!.getKey(), 3, 'text');
        $setSelection(selection);
        $joinSelectedLines();
      },
      { discrete: true },
    );
    expect(paragraphPlain(editor)).toEqual(['abc def', 'ghi']);
  });

  it('keeps the caret where the selection began instead of at the end of everything joined', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['alpha', 'beta', 'gamma']);
    editor.update(
      () => {
        $selectAll();
        $joinSelectedLines();
      },
      { discrete: true },
    );
    const selectionInfo = editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
      return selection.anchor.offset;
    });
    expect(paragraphPlain(editor)).toEqual(['alpha beta gamma']);
    // The selection began at the very start of the (now joined) text: the caret should stay
    // there, not jump to the end of everything that got joined.
    expect(selectionInfo).toBe(0);
  });

  it('keeps the caret at the selection start even when that start is mid-paragraph', () => {
    const editor = makeEditor();
    setParagraphs(editor, ['alpha', 'beta', 'gamma']);
    editor.update(
      () => {
        const texts = $getRoot().getAllTextNodes();
        const selection = $createRangeSelection();
        selection.anchor.set(texts[0]!.getKey(), 2, 'text'); // just after 'al'
        selection.focus.set(texts[2]!.getKey(), texts[2]!.getTextContentSize(), 'text');
        $setSelection(selection);
        $joinSelectedLines();
      },
      { discrete: true },
    );
    const offset = editor.getEditorState().read(() => {
      const selection = $getSelection();
      return $isRangeSelection(selection) && selection.isCollapsed() ? selection.anchor.offset : null;
    });
    expect(paragraphPlain(editor)).toEqual(['alpha beta gamma']);
    expect(offset).toBe(2);
  });
});
