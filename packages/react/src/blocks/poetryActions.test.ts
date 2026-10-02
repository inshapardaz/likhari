import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { LayoutContainerNode, LayoutItemNode } from './LayoutNode';
import { $isPoetryBlockNode, PoetryBlockNode } from './PoetryNode';
import {
  $ensureTrailingParagraph,
  $exitPoetryOnEnter,
  $getMisraParagraphs,
  $getPoetryBlockFromSelection,
  $insertPoetryCouplet,
  $setPoetryLayout,
} from './poetryActions';

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: 'test',
    nodes: [PoetryBlockNode, LayoutContainerNode, LayoutItemNode],
    onError: (e) => {
      throw e;
    },
  });
}

function withCaretInParagraph(editor: LexicalEditor, action: () => void): void {
  editor.update(
    () => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
      $getRoot().getFirstChild()!.selectEnd();
      action();
    },
    { discrete: true },
  );
}

const misraTexts = (editor: LexicalEditor): string[] =>
  editor.getEditorState().read(() => {
    const couplet = $getRoot().getChildren().find($isPoetryBlockNode);
    return couplet ? $getMisraParagraphs(couplet).map((p) => p.getTextContent()) : [];
  });

describe('$insertPoetryCouplet', () => {
  it('inserts a single-column couplet with two empty misras after the caret block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));

    editor.getEditorState().read(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      expect(couplet.getLayout()).toBe('single');
      expect(couplet.getAlign()).toBe('justify');
      expect(couplet.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
      // Always leaves somewhere editable to click after a trailing couplet.
      expect(couplet.getNextSibling()?.getType()).toBe('paragraph');
    });
    expect(misraTexts(editor)).toEqual(['', '']);
  });

  it('inserts a two-column couplet built on the layout primitive', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'start'));

    editor.getEditorState().read(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      expect(couplet.getLayout()).toBe('two-column');
      expect(couplet.getChildren()[0].getType()).toBe('layout-container');
    });
    expect(misraTexts(editor)).toEqual(['', '']);
  });

  it('does nothing without a usable selection', () => {
    const editor = makeEditor();
    editor.update(() => {
      expect($insertPoetryCouplet('single', 'justify')).toBe(false);
    });
    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some($isPoetryBlockNode)).toBe(false);
    });
  });

  it('inserts a second couplet as a sibling after the first, not nested inside it', () => {
    // getTopLevelElement() stops at the nearest shadow root — and a
    // PoetryBlockNode is one — so from a caret still inside the first
    // couplet (the common flow: insert, then insert again without moving
    // the caret) it resolves to the misra paragraph, not the couplet. This
    // regression-tests that $insertPoetryCouplet corrects for that.
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        $getMisraParagraphs(couplet)[0].selectStart(); // caret still in the first couplet
        $insertPoetryCouplet('single', 'justify');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const couplets = $getRoot().getChildren().filter($isPoetryBlockNode);
      expect(couplets).toHaveLength(2);
      for (const couplet of couplets) {
        expect(couplet.getChildren().map((c) => c.getType())).toEqual(['paragraph', 'paragraph']);
      }
    });
  });
});

describe('$setPoetryLayout', () => {
  it('moves misra content from single-column into two-column without losing text', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        const [a, b] = $getMisraParagraphs(couplet);
        a.append($createTextNode('first misra'));
        b.append($createTextNode('second misra'));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        $setPoetryLayout(couplet, 'two-column');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      expect(couplet.getLayout()).toBe('two-column');
      expect(couplet.getChildren()[0].getType()).toBe('layout-container');
    });
    expect(misraTexts(editor)).toEqual(['first misra', 'second misra']);
  });

  it('moves misra content from two-column back into single-column', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'justify'));
    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        const [a, b] = $getMisraParagraphs(couplet);
        a.append($createTextNode('x'));
        b.append($createTextNode('y'));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        $setPoetryLayout(couplet, 'single');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      expect(couplet.getLayout()).toBe('single');
      expect(couplet.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['x', 'y']);
  });

  it('is a no-op when already in the target layout', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      $setPoetryLayout(couplet, 'single');
      expect(couplet.getLayout()).toBe('single');
    });
  });
});

describe('$getPoetryBlockFromSelection', () => {
  it('finds the couplet the caret is inside, through a misra and through a layout item', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      $getMisraParagraphs(couplet)[0].selectEnd();
      expect($getPoetryBlockFromSelection()).toBe(couplet);
    });
  });

  it('returns null outside a couplet', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($getPoetryBlockFromSelection()).toBeNull();
    });
  });
});

describe('$exitPoetryOnEnter', () => {
  it('adds a paragraph after the couplet when Enter is pressed at the end of the last misra', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        $getMisraParagraphs(couplet)[1].selectEnd();
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      // paragraph ("hello"), couplet, new trailing paragraph
      expect(children).toHaveLength(3);
      expect(children[1].getType()).toBe('poetry-couplet');
      expect(children[2].getType()).toBe('paragraph');
    });
  });

  it('does nothing when the caret is not at the end of the last misra', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      $getMisraParagraphs(couplet)[0].selectEnd(); // first misra, not the last
      expect($exitPoetryOnEnter()).toBe(false);
    });
  });

  it('works for a two-column couplet too', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'justify'));
    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        $getMisraParagraphs(couplet)[1].selectEnd();
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children[children.length - 1].getType()).toBe('paragraph');
    });
  });

  it('returns false outside a couplet', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($exitPoetryOnEnter()).toBe(false);
    });
  });
});

describe('$ensureTrailingParagraph', () => {
  it('appends an empty paragraph after a couplet with no next sibling', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
        couplet.getNextSibling()!.remove(); // simulate the invariant having been broken later
        expect(couplet.getNextSibling()).toBeNull();
        $ensureTrailingParagraph(couplet);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      expect(couplet.getNextSibling()?.getType()).toBe('paragraph');
    });
  });

  it('is a no-op when a next sibling already exists', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const couplet = $getRoot().getChildren().find($isPoetryBlockNode)!;
      const sibling = couplet.getNextSibling();
      $ensureTrailingParagraph(couplet);
      expect(couplet.getNextSibling()).toBe(sibling);
    });
  });
});
