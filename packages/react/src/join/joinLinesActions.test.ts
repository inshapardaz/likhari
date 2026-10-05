import { describe, expect, it } from 'vitest';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $createRangeSelection,
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

describe('joinSelectedLines', () => {
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
});
