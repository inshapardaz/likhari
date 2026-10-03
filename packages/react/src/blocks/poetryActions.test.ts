import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, createEditor, type LexicalEditor } from 'lexical';
import { LayoutContainerNode, LayoutItemNode } from './LayoutNode';
import { $isPoetryBlockNode, PoetryBlockNode } from './PoetryNode';
import {
  $deletePoetryCouplet,
  $deletePoetryOnBackspace,
  $ensureTrailingParagraph,
  $exitPoetryOnEnter,
  $getCouplets,
  $getMisraParagraphs,
  $getPoetryBlockFromSelection,
  $adjustPoetrySpacing,
  $insertCoupletRelativeToSelection,
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

const getBlock = () => $getRoot().getChildren().find($isPoetryBlockNode)!;

const misraTexts = (editor: LexicalEditor): string[] =>
  editor.getEditorState().read(() => {
    const block = $getRoot().getChildren().find($isPoetryBlockNode);
    return block ? $getMisraParagraphs(block).map((p) => p.getTextContent()) : [];
  });

describe('$insertPoetryCouplet', () => {
  it('inserts a single-column block with one couplet after the caret block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('single');
      expect(block.getAlign()).toBe('justify');
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
      // Always leaves somewhere editable to click after a trailing block.
      expect(block.getNextSibling()?.getType()).toBe('paragraph');
    });
    expect(misraTexts(editor)).toEqual(['', '']);
  });

  it('inserts a two-column block built on the layout primitive', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'start'));

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('two-column');
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren()[0].getType()).toBe('layout-container');
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

  it('appends a second couplet to the same block when the caret is still inside it', () => {
    // getTopLevelElement() stops at the nearest shadow root — and a
    // PoetryBlockNode is one — so from a caret still inside the block (the
    // common flow: insert, then insert again without moving the caret) a
    // naive "insert after the top-level element" would resolve to the
    // misra paragraph, not the block. $insertPoetryCouplet instead detects
    // this and appends a couplet to the existing block, matching "one
    // poetry block can contain one or more couplets".
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[0].selectStart();
        $insertPoetryCouplet('single', 'justify');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const blocks = $getRoot().getChildren().filter($isPoetryBlockNode);
      expect(blocks).toHaveLength(1);
      expect($getCouplets(blocks[0])).toHaveLength(2);
    });
  });
});

describe('$setPoetryLayout', () => {
  it('moves misra content from single-column into two-column without losing text', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a, b] = $getMisraParagraphs(block);
        a.append($createTextNode('first misra'));
        b.append($createTextNode('second misra'));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'two-column');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('two-column');
      expect(block.getChildren()[0].getType()).toBe('layout-container');
    });
    expect(misraTexts(editor)).toEqual(['first misra', 'second misra']);
  });

  it('moves misra content from two-column back into single-column', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a, b] = $getMisraParagraphs(block);
        a.append($createTextNode('x'));
        b.append($createTextNode('y'));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'single');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('single');
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['x', 'y']);
  });

  it('is a no-op when already in the target layout', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const block = getBlock();
      $setPoetryLayout(block, 'single');
      expect(block.getLayout()).toBe('single');
    });
  });

  it('preserves couplet order and count across a two-couplet block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a1, b1] = $getMisraParagraphs(block);
        a1.append($createTextNode('a1'));
        b1.append($createTextNode('b1'));
        $getMisraParagraphs(block)[1].selectEnd();
        $exitPoetryOnEnter(); // appends a second couplet
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const block = getBlock();
        const [, , a2, b2] = $getMisraParagraphs(block);
        a2.append($createTextNode('a2'));
        b2.append($createTextNode('b2'));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'two-column');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
    });
    expect(misraTexts(editor)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
});

describe('$getPoetryBlockFromSelection', () => {
  it('finds the block the caret is inside, through a misra and through a layout item', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const block = getBlock();
      $getMisraParagraphs(block)[0].selectEnd();
      expect($getPoetryBlockFromSelection()).toBe(block);
    });
  });

  it('returns null outside a block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($getPoetryBlockFromSelection()).toBeNull();
    });
  });
});

describe('$exitPoetryOnEnter', () => {
  it('moves to the second misra when Enter is pressed anywhere in the first, without growing the couplet', () => {
    // Regression test: this used to fall through to the default Enter
    // handling, which inserted a brand-new paragraph *between* the two
    // misras instead of moving into the existing second one.
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a] = $getMisraParagraphs(block);
        a.append($createTextNode('line one')); // non-empty: a genuinely-empty
        // couplet's Enter is the exit trigger instead (tested separately).
        a.selectStart();
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getMisraParagraphs(block)).toHaveLength(2);
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.anchor.getNode().getKey()).toBe($getMisraParagraphs(block)[1].getKey());
    });
  });

  it('appends a new couplet when Enter is pressed at the end of a non-empty last couplet', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [, b] = $getMisraParagraphs(block);
        b.append($createTextNode('line two'));
        b.selectEnd();
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
      // Still just the one block — appended, not a new top-level sibling.
      expect($getRoot().getChildren().filter($isPoetryBlockNode)).toHaveLength(1);
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.anchor.getNode().getKey()).toBe($getMisraParagraphs(block)[2].getKey());
    });
  });

  it('exits the block on a second Enter pressed on the fresh empty couplet ("double enter")', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [, b] = $getMisraParagraphs(block);
        b.append($createTextNode('line two'));
        b.selectEnd();
        expect($exitPoetryOnEnter()).toBe(true); // 1st Enter: appends empty couplet 2
        expect($exitPoetryOnEnter()).toBe(true); // 2nd Enter: couplet 2 still empty -> exit
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      // The auto-created empty couplet is dropped on exit.
      expect($getCouplets(block)).toHaveLength(1);
      const children = $getRoot().getChildren();
      expect(children[children.length - 1].getType()).toBe('paragraph');
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.anchor.getNode().getKey()).toBe(children[children.length - 1].getKey());
    });
  });

  it('moves to the next couplet when Enter is pressed at the end of a non-last couplet', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a, b] = $getMisraParagraphs(block);
        a.append($createTextNode('a1'));
        b.append($createTextNode('b1')); // non-empty, so Enter appends rather than exits
        b.selectEnd();
        $exitPoetryOnEnter(); // appends couplet 2, 2 couplets now
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[1].selectEnd(); // end of couplet 1's last misra again
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2); // unchanged: moved, didn't insert
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.anchor.getNode().getKey()).toBe($getMisraParagraphs(block)[2].getKey());
    });
  });

  it('works for a two-column block too', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [, b] = $getMisraParagraphs(block);
        b.append($createTextNode('x'));
        b.selectEnd();
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
      expect(block.getChildren().every((c) => c.getType() === 'layout-container')).toBe(true);
    });
  });

  it('returns false outside a block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($exitPoetryOnEnter()).toBe(false);
    });
  });
});

describe('$ensureTrailingParagraph', () => {
  it('appends an empty paragraph after a block with no next sibling', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        block.getNextSibling()!.remove(); // simulate the invariant having been broken later
        expect(block.getNextSibling()).toBeNull();
        $ensureTrailingParagraph(block);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect(getBlock().getNextSibling()?.getType()).toBe('paragraph');
    });
  });

  it('is a no-op when a next sibling already exists', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const block = getBlock();
      const sibling = block.getNextSibling();
      $ensureTrailingParagraph(block);
      expect(block.getNextSibling()).toBe(sibling);
    });
  });
});

describe('PoetryBlockNode width', () => {
  it('is undefined (falls back to the CSS default) until set', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getWidth()).toBeUndefined();
      expect(block.exportJSON().width).toBeUndefined();
    });
  });

  it('round-trips a drag-resized width through setWidth and JSON', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        getBlock().setWidth(420);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getWidth()).toBe(420);
      expect(block.exportJSON().width).toBe(420);
    });
  });
});

describe('$deletePoetryCouplet', () => {
  it('removes the whole block when it has only one couplet', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[0].selectEnd();
        expect($deletePoetryCouplet()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some($isPoetryBlockNode)).toBe(false);
    });
  });

  it('removes just the targeted couplet when the block has more than one', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a1, b1] = $getMisraParagraphs(block);
        a1.append($createTextNode('a1'));
        b1.append($createTextNode('b1'));
        b1.selectEnd();
        $exitPoetryOnEnter(); // couplet 2, empty
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[2].selectEnd(); // caret in couplet 2
        expect($deletePoetryCouplet()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1);
    });
    expect(misraTexts(editor)).toEqual(['a1', 'b1']);
  });

  it('removes a targeted couplet from a two-column block (its own LayoutContainerNode row)', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a, b] = $getMisraParagraphs(block);
        a.append($createTextNode('a1'));
        b.append($createTextNode('b1')); // non-empty, so Enter appends rather than exits
        b.selectEnd();
        $exitPoetryOnEnter(); // couplet 2
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[0].selectEnd(); // couplet 1
        expect($deletePoetryCouplet()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren().filter((c) => c.getType() === 'layout-container')).toHaveLength(1);
    });
  });

  it('returns false outside a block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($deletePoetryCouplet()).toBe(false);
    });
  });
});

describe('$deletePoetryOnBackspace', () => {
  it('removes the whole block when its only (empty) couplet is backspaced at the start', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[0].selectStart();
        expect($deletePoetryOnBackspace()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some($isPoetryBlockNode)).toBe(false);
    });
  });

  it('merges an empty couplet into the end of the previous one, keeping the block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(
      () => {
        const block = getBlock();
        const [a1, b1] = $getMisraParagraphs(block);
        a1.append($createTextNode('a1'));
        b1.append($createTextNode('b1'));
        b1.selectEnd();
        $exitPoetryOnEnter(); // couplet 2, empty
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[2].selectStart(); // start of couplet 2's first misra
        expect($deletePoetryOnBackspace()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1);
      const lastMisra = $getMisraParagraphs(block)[1];
      const selection = $getSelection();
      // selectEnd() on a non-empty paragraph lands on its text child, not
      // the paragraph itself — check containment, not an exact key match.
      const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
      expect(anchorNode !== null && (lastMisra.getKey() === anchorNode.getKey() || lastMisra.isParentOf(anchorNode))).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['a1', 'b1']);
  });

  it('does nothing when the couplet has content', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const block = getBlock();
      const [first] = $getMisraParagraphs(block);
      first.append($createTextNode('x'));
      first.selectStart();
      expect($deletePoetryOnBackspace()).toBe(false);
    });
  });

  it('does nothing when the caret is not at the very start of a couplet\'s first misra', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const block = getBlock();
      $getMisraParagraphs(block)[1].selectStart(); // second misra, not the first
      expect($deletePoetryOnBackspace()).toBe(false);
    });
  });

  it('returns false outside a block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($deletePoetryOnBackspace()).toBe(false);
    });
  });
});

describe('$insertCoupletRelativeToSelection', () => {
  it('inserts a couplet above the current one in single layout', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    editor.update(() => {
      const first = $getCouplets(getBlock())[0][0];
      first.selectStart();
      $insertCoupletRelativeToSelection('before');
    }, { discrete: true });
    expect(misraTexts(editor)).toEqual(['', '', '', '']);
    editor.getEditorState().read(() => expect($getCouplets(getBlock())).toHaveLength(2));
  });

  it('inserts a couplet below the current one in two-column layout, keeping order', () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('x')));
      $getRoot().getFirstChild()!.selectEnd();
      $insertPoetryCouplet('two-column', 'justify');
    }, { discrete: true });
    editor.update(() => {
      const [a, b] = $getCouplets(getBlock())[0];
      a.append($createTextNode('A1'));
      b.append($createTextNode('B1'));
      a.selectEnd();
      $insertCoupletRelativeToSelection('after');
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const couplets = $getCouplets(getBlock());
      expect(couplets).toHaveLength(2);
      expect(couplets[0][0].getTextContent()).toBe('A1');
      expect(couplets[1][0].getTextContent()).toBe('');
    });
  });

  it('returns false outside a poetry block', () => {
    const editor = makeEditor();
    let result = true;
    withCaretInParagraph(editor, () => {
      result = $insertCoupletRelativeToSelection('after');
    });
    expect(result).toBe(false);
  });
});

describe('$adjustPoetrySpacing', () => {
  it('steps spacing looser and tighter and clamps at both ends', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single', 'justify'));
    const spacingNow = () => editor.getEditorState().read(() => getBlock().getSpacing());
    const step = (delta: 1 | -1) =>
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          $adjustPoetrySpacing(delta);
        },
        { discrete: true },
      );
    expect(spacingNow()).toBe('normal');
    step(1);
    expect(spacingNow()).toBe('relaxed');
    step(1);
    step(1);
    expect(spacingNow()).toBe('loose');
    step(-1);
    expect(spacingNow()).toBe('relaxed');
  });
});
