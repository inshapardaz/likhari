import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { LayoutContainerNode, LayoutItemNode } from './LayoutNode';
import { $isPoetryBlockNode, PoetryBlockNode } from './PoetryNode';
import { $getMisraParagraphs, $getPoetryBlockFromSelection, $insertPoetryCouplet, $setPoetryLayout } from './poetryActions';

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
