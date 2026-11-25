import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $correctPunctuationBeforeCaret, $correctPunctuationDocument, $preservingSelection } from './autoCorrectActions';
import { activePunctuationRules, spacePunctuationText } from './punctuationRules';

function editorWith(text: string, caret: number, rtl = false) {
  const editor = createEditor({
    namespace: 'punctuation-test',
    onError: (e) => {
      throw e;
    },
  });
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      if (rtl) paragraph.setDirection('rtl');
      $getRoot().clear().append(paragraph.append($createTextNode(text)));
    },
    { discrete: true },
  );
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

  it('opens a straight double quote at the start of the text', () => {
    const editor = editorWith('"', 1);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(1, 1);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('“');
  });

  it('closes a straight double quote right after a word', () => {
    const editor = editorWith('hi"', 3);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(3, 3);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('hi”');
  });

  it('opens a straight double quote after whitespace', () => {
    const editor = editorWith('hi "', 4);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(4, 4);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('hi “');
  });

  it('opens with ” (not “) at the start of a right-to-left block — the Urdu/Shahmukhi pair is reversed from Latin', () => {
    const editor = editorWith('"', 1, true);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(1, 1);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('”');
  });

  it('opens with ” at the start of a new paragraph split off Urdu text, even though the new paragraph has no `dir` of its own yet', () => {
    // Reproduces a real editing sequence: an Urdu paragraph already exists, Enter starts a
    // new (empty) paragraph, and the straight quote is the very first character typed into
    // it. Lexical only recomputes a paragraph's cached `dir` once it goes through a DOM
    // reconcile, which this headless test never triggers — so the new paragraph's own
    // getDirection() stays null, exactly like the real editor leaves it stale for a
    // paragraph that is dirty for the first time (see autoCorrectActions.ts, $isBlockRtl).
    const editor = createEditor({
      namespace: 'punctuation-test-sibling',
      onError: (e) => {
        throw e;
      },
    });
    editor.update(
      () => {
        const urdu = $createParagraphNode().append($createTextNode('حمید نے کہا۔'));
        const empty = $createParagraphNode().append($createTextNode('"'));
        $getRoot().clear().append(urdu, empty);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $getRoot().getLastChild<import('lexical').ElementNode>()!.getAllTextNodes()[0].select(1, 1);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('حمید نے کہا۔\n\n”');
  });

  it('closes with “ (not ”) right after a word in a right-to-left block', () => {
    const editor = editorWith('ہے"', 3, true);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(3, 3);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('ہے“');
  });

  it('closes with “ and drops the space between ۔ and the quote, instead of reading the space as the start of a new quotation', () => {
    // Without a fixed rule for "۔ \"", the space made the bare-`"` resolve rule see an
    // opening context (any whitespace before a `"` looks like the start of a quotation)
    // and emit the wrong mark — ” instead of the “ that actually closes the sentence.
    const editor = editorWith('حمید نے کہا۔ "', 14, true);
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(14, 14);
        $correctPunctuationBeforeCaret(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('حمید نے کہا۔“');
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
    // The quote uses the Urdu/RTL convention from the Urdu text around it, even though this
    // block is left-to-right — Lexical's own block `dir` is only a fallback (punctuationRules.ts).
    expect(textOf(editor)).toBe('ہے۔ وہ ”ٹھیک“ ہے۔“');
  });

  it('uses the right-to-left convention from the surrounding Urdu text, not the block\'s own (possibly mislabelled) direction', () => {
    // A single stray Latin letter before any Urdu character marks the whole block ltr in
    // Lexical's own direction detection (see autoCorrectActions.ts) — the quote must still
    // follow the Urdu text immediately around it, not that block-wide label.
    const editor = editorWith('X وہ "ٹھیک" ہے۔', 0);
    editor.update(
      () => {
        $correctPunctuationDocument(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('X وہ ”ٹھیک“ ہے۔');
  });

  it('uses the reversed ”/“ pair for a right-to-left block', () => {
    const editor = editorWith('ہے. وہ "ٹھیک" ہے۔"', 0, true);
    editor.update(
      () => {
        $correctPunctuationDocument(activePunctuationRules());
      },
      { discrete: true },
    );
    // The trailing "۔\"" is matched by a fixed (direction-agnostic) bundled rule, not the
    // resolve-based one — only the two quotes resolved from a bare `"` flip with direction.
    expect(textOf(editor)).toBe('ہے۔ وہ ”ٹھیک“ ہے۔“');
  });

  it('fixes an opening “ at the start of a right-to-left sentence to ”', () => {
    const editor = editorWith('“سلام”', 0, true);
    editor.update(
      () => {
        $correctPunctuationDocument(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(textOf(editor)).toBe('”سلام“');
  });

  it('leaves an already-correct quote pair alone in either direction', () => {
    const ltr = editorWith('“hi”', 0);
    let ltrCount = -1;
    ltr.update(
      () => {
        ltrCount = $correctPunctuationDocument(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(ltrCount).toBe(0);
    expect(textOf(ltr)).toBe('“hi”');

    const rtl = editorWith('”سلام“', 0, true);
    let rtlCount = -1;
    rtl.update(
      () => {
        rtlCount = $correctPunctuationDocument(activePunctuationRules());
      },
      { discrete: true },
    );
    expect(rtlCount).toBe(0);
    expect(textOf(rtl)).toBe('”سلام“');
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
