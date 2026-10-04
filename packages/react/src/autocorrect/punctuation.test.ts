import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $correctPunctuationBeforeCaret, $correctPunctuationDocument, $preservingSelection } from './autoCorrectActions';
import { activePunctuationRules, spacePunctuationText } from './punctuationRules';

function editorWith(text: string, caret: number) {
  const editor = createEditor({
    namespace: 'punctuation-test',
    onError: (e) => {
      throw e;
    },
  });
  editor.update(() => $getRoot().clear().append($createParagraphNode().append($createTextNode(text))), { discrete: true });
  return editor;
}

const textOf = (editor: ReturnType<typeof editorWith>) => editor.getEditorState().read(() => $getRoot().getTextContent());

describe('activePunctuationRules', () => {
  it('turns the straight double quote into ” by default, and can be turned off', () => {
    expect(activePunctuationRules().some((r) => r.incorrect === '"' && r.correct === '”')).toBe(true);
    expect(activePunctuationRules({ straightDoubleQuote: false }).some((r) => r.incorrect === '"')).toBe(false);
    expect(activePunctuationRules({ enabled: false })).toEqual([]);
  });

  it('orders rules longest first, so ۔" is matched before "', () => {
    const rules = activePunctuationRules();
    expect(rules.findIndex((r) => r.incorrect === '۔"')).toBeLessThan(rules.findIndex((r) => r.incorrect === '"'));
  });
});

describe('$correctPunctuationBeforeCaret', () => {
  it('replaces a Latin full stop typed after a word with the Urdu one, and keeps the caret after it', () => {
    const editor = editorWith('ہے.', 3);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(3, 3);
        expect($correctPunctuationBeforeCaret(activePunctuationRules())).toBe(true);
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('ہے۔');
  });

  it('replaces a straight double quote with ”', () => {
    const editor = editorWith('"', 1);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(1, 1);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('”');
  });
});

describe('$correctPunctuationDocument', () => {
  it('applies every match across the document, preferring the longer rule where they overlap', () => {
    const editor = editorWith('ہے. وہ "ٹھیک" ہے۔"', 0);
    let count = 0;
    editor.update(
      () => {
        count = $correctPunctuationDocument(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(count).toBeGreaterThan(0);
    expect(textOf(editor)).toBe('ہے۔ وہ ”ٹھیک” ہے۔“');
  });
});

describe('$preservingSelection', () => {
  it('leaves the caret where it was after a whole-document pass', () => {
    const editor = editorWith('ہے. وہ ہے.', 2);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(2, 2);
        $preservingSelection(() => {
          $correctPunctuationDocument(activePunctuationRules());
        });
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.anchor.offset).toBe(2);
      expect($isRangeSelection(selection) && selection.anchor.getNode().getTextContent()).toBe('ہے۔ وہ ہے۔');
    });
  });
});

describe('spacePunctuationText', () => {
  it('spaces after Urdu punctuation and removes spaces before it, but not inside numbers', () => {
    expect(spacePunctuationText('ہے۔وہ ہے')).toBe('ہے۔ وہ ہے');
    expect(spacePunctuationText('ہے ۔ وہ')).toBe('ہے۔ وہ');
    expect(spacePunctuationText('۹.۰۰ روپے')).toBe('۹.۰۰ روپے');
  });
});
