import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { $findMatches, $replaceAll, $replaceMatch } from './findReplaceActions';

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: 'find-test',
    onError: (e) => {
      throw e;
    },
  });
}

function setParagraphs(editor: LexicalEditor, paragraphs: string[][]): void {
  editor.update(
    () => {
      const root = $getRoot().clear();
      for (const parts of paragraphs) {
        const paragraph = $createParagraphNode();
        for (const part of parts) paragraph.append($createTextNode(part));
        root.append(paragraph);
      }
    },
    { discrete: true },
  );
}

const paragraphTexts = (editor: LexicalEditor): string[] =>
  editor.getEditorState().read(() => $getRoot().getChildren().map((p) => p.getTextContent()));

describe('$findMatches', () => {
  it('finds every occurrence, across paragraphs', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['one cat and a cat'], ['no match'], ['cat']]);
    editor.getEditorState().read(() => expect($findMatches('cat')).toHaveLength(3));
  });

  it('finds a match split across formatted text nodes', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['hel', 'lo world']]);
    editor.getEditorState().read(() => expect($findMatches('hello')).toHaveLength(1));
  });

  it('returns nothing for an empty query', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['text']]);
    editor.getEditorState().read(() => expect($findMatches('')).toHaveLength(0));
  });

  it('does not match across two paragraphs', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['end'], ['start']]);
    editor.getEditorState().read(() => expect($findMatches('endstart')).toHaveLength(0));
  });
});

describe('$replaceMatch and $replaceAll', () => {
  it('replaces one match and leaves the others', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['a cat and a cat']]);
    editor.update(
      () => {
        const [first] = $findMatches('cat');
        $replaceMatch(first, 'dog');
      },
      { discrete: true },
    );
    expect(paragraphTexts(editor)).toEqual(['a dog and a cat']);
  });

  it('replaces all matches, including across paragraphs', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['x-x-x'], ['x']]);
    let count = 0;
    editor.update(
      () => {
        count = $replaceAll('x', 'yy');
      },
      { discrete: true },
    );
    expect(count).toBe(4);
    expect(paragraphTexts(editor)).toEqual(['yy-yy-yy', 'yy']);
  });

  it('replacing with an empty string removes the match', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['remove me please']]);
    editor.update(
      () => {
        $replaceAll(' me', '');
      },
      { discrete: true },
    );
    expect(paragraphTexts(editor)).toEqual(['remove please']);
  });

  it('replaces a match that spans formatted text nodes', () => {
    const editor = makeEditor();
    setParagraphs(editor, [['hel', 'lo']]);
    editor.update(
      () => {
        $replaceAll('hello', 'bye');
      },
      { discrete: true },
    );
    expect(paragraphTexts(editor)).toEqual(['bye']);
  });
});
