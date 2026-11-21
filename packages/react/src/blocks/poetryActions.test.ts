import { describe, expect, it } from 'vitest';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type TextNode,
} from 'lexical';
import { LayoutContainerNode, LayoutItemNode } from './LayoutNode';
import { $isPoetryBlockNode, PoetryBlockNode } from './PoetryNode';
import {
  $completeSingleCoupletBlock,
  $convertSelectionToPoetry,
  $getCoupletContaining,
  $getCoupletFromSelection,
  $moveCouplet,
  $swapMisras,
  $deletePoetryBlock,
  $deletePoetryCouplet,
  $deletePoetryOnBackspace,
  $ensureTrailingParagraph,
  $exitPoetryOnEnter,
  $getCouplets,
  $getMisraParagraphs,
  $getPoetryBlockFromSelection,
  $adjustPoetryCenterWidth,
  $adjustPoetryGutter,
  $adjustPoetrySpacing,
  $adjustPoetryStagger,
  $getCoupletCenteredFromSelection,
  $setCoupletCentered,
  $insertCoupletRelativeToSelection,
  $insertPoetryCouplet,
  $setPoetryAutoWidth,
  $setPoetryLayout,
  $setPoetryStaggerGroup,
  $setPoetryStanzaVariant,
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('single');
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
      // Always leaves somewhere editable to click after a trailing block.
      expect(block.getNextSibling()?.getType()).toBe('paragraph');
    });
    expect(misraTexts(editor)).toEqual(['', '']);
  });

  it('inserts a two-column block built on the layout primitive', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));

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
      expect($insertPoetryCouplet('single')).toBe(false);
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[0].selectStart();
        $insertPoetryCouplet('single');
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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

  it('keeps the caret in the same misra, instead of losing it outside the block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        const block = getBlock();
        const [a, b] = $getMisraParagraphs(block);
        a.append($createTextNode('first misra'));
        b.append($createTextNode('second misra'));
      },
      { discrete: true },
    );
    // Centering relies on the caret staying inside a misra across a layout
    // change — this was the actual bug behind issue #27's menu items never
    // being reachable (the caret landed outside the block instead). Selects,
    // changes layout and centers all in one update, mirroring how the
    // toolbar's poetry menu actually drives this (restoreSelection, then the
    // action, in the same editor.update()).
    editor.update(
      () => {
        $getMisraParagraphs(getBlock())[1].selectEnd();
        $setPoetryLayout(getBlock(), 'two-column');
        expect($isRangeSelection($getSelection())).toBe(true);
        expect($getPoetryBlockFromSelection()).not.toBeNull();
        expect($setCoupletCentered(true)).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      expect($getCoupletCenteredFromSelection()).toBe(true);
    });
  });

  it('moves misra content from two-column back into single-column', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const block = getBlock();
      $setPoetryLayout(block, 'single');
      expect(block.getLayout()).toBe('single');
    });
  });

  it('preserves couplet order and count across a two-couplet block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getWidth()).toBeUndefined();
      expect(block.exportJSON().width).toBeUndefined();
    });
  });

  it('round-trips a drag-resized width through setWidth and JSON', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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

  it('never merges a line with content into the line before it', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const block = getBlock();
      const [first, second] = $getMisraParagraphs(block);
      first.append($createTextNode('x'));
      second.append($createTextNode('y'));
      second.selectStart();
      expect($deletePoetryOnBackspace()).toBe(true);
    }, { discrete: true });
    expect(misraTexts(editor)).toEqual(['x', 'y']);
  });

  it('leaves caret positions inside text to normal deletion', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const block = getBlock();
      const [first] = $getMisraParagraphs(block);
      first.append($createTextNode('abc'));
      (first.getFirstChild() as TextNode).select(1, 1);
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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
      $insertPoetryCouplet('two-column');
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
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
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

describe('$adjustPoetryGutter', () => {
  it('steps the gutter wider and narrower and clamps at both ends', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
    const gutterNow = () => editor.getEditorState().read(() => getBlock().getGutter());
    const step = (delta: 1 | -1) =>
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          $adjustPoetryGutter(delta);
        },
        { discrete: true },
      );
    expect(gutterNow()).toBe('normal');
    step(-1);
    expect(gutterNow()).toBe('compact');
    step(-1);
    expect(gutterNow()).toBe('compact');
    step(1);
    step(1);
    step(1);
    expect(gutterNow()).toBe('loose');
  });
});

describe('$adjustPoetryCenterWidth', () => {
  it('steps the centered-couplet width narrower and wider and clamps at both ends', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
    const centerWidthNow = () => editor.getEditorState().read(() => getBlock().getCenterWidth());
    const step = (delta: 1 | -1) =>
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          $adjustPoetryCenterWidth(delta);
        },
        { discrete: true },
      );
    expect(centerWidthNow()).toBe('normal');
    step(-1);
    expect(centerWidthNow()).toBe('compact');
    step(-1);
    expect(centerWidthNow()).toBe('compact');
    step(1);
    step(1);
    step(1);
    expect(centerWidthNow()).toBe('loose');
  });
});

describe('staggered layout', () => {
  it('keeps every couplet readable when switching single column to staggered', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const block = getBlock();
      block.getFirstChild()!.selectStart();
      $insertCoupletRelativeToSelection('after');
      $setPoetryLayout(block, 'staggered');
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('staggered');
      expect($getCouplets(block)).toHaveLength(2);
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
  });
});

describe('$adjustPoetryStagger', () => {
  it('steps the staggered couplet width narrower and wider and clamps at both ends', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('staggered'));
    const staggerNow = () => editor.getEditorState().read(() => getBlock().getStagger());
    const step = (delta: 1 | -1) =>
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          $adjustPoetryStagger(delta);
        },
        { discrete: true },
      );
    expect(staggerNow()).toBe('normal');
    step(-1);
    expect(staggerNow()).toBe('compact');
    step(-1);
    expect(staggerNow()).toBe('compact');
    step(1);
    step(1);
    step(1);
    expect(staggerNow()).toBe('loose');
  });
});

describe('$setCoupletCentered', () => {
  it('centers a two-column couplet in place, keeping its text, and un-centers it again', () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('x')));
      $getRoot().getFirstChild()!.selectEnd();
      $insertPoetryCouplet('two-column');
    }, { discrete: true });
    editor.update(() => {
      const [a, b] = $getCouplets(getBlock())[0];
      a.append($createTextNode('A1'));
      b.append($createTextNode('B1'));
      a.selectEnd();
      $setCoupletCentered(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      const [couplet] = $getCouplets(block);
      expect(couplet.map((p) => p.getTextContent())).toEqual(['A1', 'B1']);
      expect((block.getChildren()[0] as ElementNode).getChildren()).toHaveLength(1);
    });
    editor.update(() => {
      $getCouplets(getBlock())[0][0].selectEnd();
      expect($getCoupletCenteredFromSelection()).toBe(true);
      $setCoupletCentered(false);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['A1', 'B1']);
      expect((block.getChildren()[0] as ElementNode).getChildren()).toHaveLength(2);
    });
  });

  it('does nothing in single-column layout', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    let result = true;
    editor.update(() => {
      getBlock().getFirstChild()!.selectStart();
      result = $setCoupletCentered(true);
    }, { discrete: true });
    expect(result).toBe(false);
  });
});

/** Builds a `mukhammas` block, in `stanzaVariant: 'mixed'`, with misra text
 * 'a'..'e' — the shape the centered-trailing-line tests below toggle. */
function buildMixedMukhammas(editor: LexicalEditor): void {
  withCaretInParagraph(editor, () => {
    $insertPoetryCouplet('mukhammas');
    const misras = $getMisraParagraphs(getBlock());
    ['a', 'b', 'c', 'd', 'e'].forEach((t, i) => misras[i].append($createTextNode(t)));
    getBlock().getFirstChild()!.selectStart();
    $setPoetryStanzaVariant('mixed');
  });
}

describe('$setCoupletCentered on a mixed stanza\'s trailing misra group', () => {
  it('is centered by default — $buildCoupletNodes defaults mukhammas-mixed\'s trailing line to centered (matching IconPoetryMixed\'s depiction) — and can be un-centered and re-centered', () => {
    const editor = makeEditor();
    buildMixedMukhammas(editor);

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
    editor.update(() => {
      $getCouplets(getBlock())[0][4].selectEnd();
      expect($getCoupletCenteredFromSelection()).toBe(true);
    }, { discrete: true });

    editor.update(() => {
      $getCouplets(getBlock())[0][4].selectEnd();
      expect($setCoupletCentered(false)).toBe(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'paragraph']);
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    editor.update(() => {
      const misras = $getMisraParagraphs(getBlock());
      misras[4].selectEnd(); // 'e', the trailing line, now bare
      expect($setCoupletCentered(true)).toBe(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  it('$getCouplets reads the stanza correctly whether the trailing line is bare or centered-wrapped', () => {
    const editor = makeEditor();
    buildMixedMukhammas(editor);
    editor.update(() => {
      // Centered-wrapped by default (see the first test in this block).
      expect($getCouplets(getBlock())[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e']);
      $getMisraParagraphs(getBlock())[4].selectEnd();
      $setCoupletCentered(false);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      // Reads the same 5 misras back, in the same order, once un-wrapped.
      expect($getCouplets(getBlock())[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  it('is centered by default for musaddas-mixed too, as a group of both trailing lines together, and can be un-centered and re-centered', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      $insertPoetryCouplet('musaddas');
      const misras = $getMisraParagraphs(getBlock());
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((t, i) => misras[i].append($createTextNode(t)));
      getBlock().getFirstChild()!.selectStart();
      $setPoetryStanzaVariant('mixed');
    });

    editor.getEditorState().read(() => {
      const block = getBlock();
      // Both trailing misras ('e', 'f') share one centered layout-container,
      // not two bare paragraphs.
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });
    editor.update(() => {
      $getCouplets(getBlock())[0][5].selectEnd(); // 'f', the last trailing misra
      expect($getCoupletCenteredFromSelection()).toBe(true);
      expect($setCoupletCentered(false)).toBe(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'paragraph', 'paragraph']);
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });
    editor.update(() => {
      $getMisraParagraphs(getBlock())[4].selectEnd(); // 'e', now bare
      expect($setCoupletCentered(true)).toBe(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      expect($getCouplets(block)[0].map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });
  });

  it('is a no-op (false/null) for mukhammas in continuous or split stanzaVariant', () => {
    for (const stanzaVariant of ['continuous', 'split'] as const) {
      const editor = makeEditor();
      withCaretInParagraph(editor, () => {
        $insertPoetryCouplet('mukhammas');
        const misras = $getMisraParagraphs(getBlock());
        ['a', 'b', 'c', 'd', 'e'].forEach((t, i) => misras[i].append($createTextNode(t)));
        if (stanzaVariant !== 'continuous') {
          getBlock().getFirstChild()!.selectStart();
          $setPoetryStanzaVariant(stanzaVariant);
        }
      });
      editor.update(() => {
        $getMisraParagraphs(getBlock())[4].selectEnd();
        expect($getCoupletCenteredFromSelection()).toBe(null);
        expect($setCoupletCentered(true)).toBe(false);
      }, { discrete: true });
    }
  });

  it('round-trips a centered mukhammas-mixed block through full editor-state JSON', () => {
    const editor = makeEditor();
    buildMixedMukhammas(editor);
    editor.update(() => {
      $getMisraParagraphs(getBlock())[4].selectEnd();
      $setCoupletCentered(true);
    }, { discrete: true });

    const json = editor.getEditorState().toJSON();
    const restoredState = editor.parseEditorState(json);
    editor.setEditorState(restoredState);

    editor.update(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('mukhammas');
      expect(block.getStanzaVariant()).toBe('mixed');
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      const couplet = $getCouplets(block)[0];
      expect(couplet.map((p) => p.getTextContent())).toEqual(['a', 'b', 'c', 'd', 'e']);
      couplet[4].selectEnd();
      expect($getCoupletCenteredFromSelection()).toBe(true);
    }, { discrete: true });
  });
});

describe('$deletePoetryBlock', () => {
  it('removes the whole block with all its couplets', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const block = getBlock();
      block.getFirstChild()!.selectStart();
      $insertCoupletRelativeToSelection('after');
    }, { discrete: true });
    editor.update(() => {
      getBlock().getFirstChild()!.selectStart();
      expect($deletePoetryBlock()).toBe(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some($isPoetryBlockNode)).toBe(false);
    });
  });
});

describe('deleting an empty last couplet', () => {
  it('from its second line keeps every line of the previous couplet', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const [a, b] = $getMisraParagraphs(getBlock());
      a.append($createTextNode('a1'));
      b.append($createTextNode('b1'));
      b.selectEnd();
      $insertCoupletRelativeToSelection('after');
    }, { discrete: true });
    editor.update(() => {
      const misras = $getMisraParagraphs(getBlock());
      misras[3].selectStart();
      expect($deletePoetryOnBackspace()).toBe(true);
    }, { discrete: true });
    expect(misraTexts(editor)).toEqual(['a1', 'b1']);
  });
});

describe('$completeSingleCoupletBlock', () => {
  it('gives an unpaired empty single-column line a partner so it can be deleted, keeping earlier couplets intact', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(() => {
      const block = getBlock();
      const [a, b] = $getMisraParagraphs(block);
      a.append($createTextNode('a1'));
      b.append($createTextNode('b1'));
      block.append($createParagraphNode());
      $completeSingleCoupletBlock(block);
    }, { discrete: true });
    expect(misraTexts(editor)).toEqual(['a1', 'b1', '', '']);
    editor.update(() => {
      const misras = $getMisraParagraphs(getBlock());
      misras[3].selectStart();
      expect($deletePoetryOnBackspace()).toBe(true);
    }, { discrete: true });
    expect(misraTexts(editor)).toEqual(['a1', 'b1']);
  });
});

describe('PoetryBlockNode.importJSON (issue #29)', () => {
  it('falls back to defaults for invalid layout, spacing, gutter, stagger and centerWidth', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const block = PoetryBlockNode.importJSON({
          type: 'poetry-couplet',
          version: 1,
          layout: 'quadruple-column' as unknown as 'single',
          spacing: 'enormous' as unknown as 'normal',
          gutter: 'huge' as unknown as 'normal',
          stagger: 'gigantic' as unknown as 'normal',
          centerWidth: 'massive' as unknown as 'normal',
          children: [],
          direction: null,
          format: '',
          indent: 0,
        });
        expect(block.getLayout()).toBe('single');
        expect(block.getSpacing()).toBe('normal');
        expect(block.getGutter()).toBe('normal');
        expect(block.getStagger()).toBe('normal');
        expect(block.getCenterWidth()).toBe('normal');
      },
      { discrete: true },
    );
  });

  it('keeps valid settings, including a non-default centerWidth', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const block = PoetryBlockNode.importJSON({
          type: 'poetry-couplet',
          version: 1,
          layout: 'two-column',
          spacing: 'loose',
          gutter: 'compact',
          stagger: 'relaxed',
          centerWidth: 'loose',
          width: 400,
          children: [],
          direction: null,
          format: '',
          indent: 0,
        });
        expect(block.getLayout()).toBe('two-column');
        expect(block.getSpacing()).toBe('loose');
        expect(block.getGutter()).toBe('compact');
        expect(block.getStagger()).toBe('relaxed');
        expect(block.getCenterWidth()).toBe('loose');
        expect(block.getWidth()).toBe(400);
      },
      { discrete: true },
    );
  });

  it('round-trips through exportJSON', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
    editor.update(
      () => {
        const block = getBlock();
        block.setCenterWidth('relaxed');
      },
      { discrete: true },
    );
    const json = editor.getEditorState().read(() => getBlock().exportJSON());
    expect(json.centerWidth).toBe('relaxed');
    editor.update(
      () => {
        const restored = PoetryBlockNode.importJSON(json);
        expect(restored.getCenterWidth()).toBe('relaxed');
      },
      { discrete: true },
    );
  });
});

/** Selects from the start of the first text node to the end of the last. */
function $selectAcross(first: TextNode, last: TextNode): void {
  const selection = $createRangeSelection();
  selection.anchor.set(first.getKey(), 0, 'text');
  selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
  $setSelection(selection);
}

describe('$convertSelectionToPoetry', () => {
  it('turns the selected paragraphs into one single-column block, trimming lines and dropping blank ones', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const root = $getRoot();
        const before = $createParagraphNode().append($createTextNode('intro'));
        const first = $createTextNode('  line one  ');
        const p1 = $createParagraphNode().append(first);
        const blank = $createParagraphNode().append($createTextNode('   '));
        const empty = $createParagraphNode();
        const last = $createTextNode('line two');
        const p2 = $createParagraphNode().append(last);
        const after = $createParagraphNode().append($createTextNode('outro'));
        root.append(before, p1, blank, empty, p2, after);
        $selectAcross(first, last);
        expect($convertSelectionToPoetry()).toBe(true);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((c) => c.getType())).toEqual(['paragraph', 'poetry-couplet', 'paragraph']);
      const block = getBlock();
      expect(block.getLayout()).toBe('single');
      expect($getCouplets(block)).toHaveLength(1);
      // The caret lands at the start of the new block's first misra.
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.isCollapsed()).toBe(true);
      expect($getCoupletFromSelection()?.[0].getTextContent()).toBe('line one');
    });
    expect(misraTexts(editor)).toEqual(['line one', 'line two']);
  });

  it('splits a paragraph on its hard line breaks, keeps inline formatting, and pairs a dangling line with an empty partner', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const first = $createTextNode('alpha ');
        const bold = $createTextNode('beta').toggleFormat('bold');
        const last = $createTextNode('gamma');
        $getRoot().append(
          $createParagraphNode().append(first, $createLineBreakNode(), bold, $createLineBreakNode(), $createLineBreakNode(), last),
        );
        $selectAcross(first, last);
        expect($convertSelectionToPoetry()).toBe(true);
      },
      { discrete: true },
    );

    expect(misraTexts(editor)).toEqual(['alpha', 'beta', 'gamma', '']);
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
      const beta = $getMisraParagraphs(block)[1].getFirstChild() as TextNode;
      expect(beta.hasFormat('bold')).toBe(true);
      expect(block.getNextSibling()?.getType()).toBe('paragraph');
    });
  });

  it('is the behaviour of $insertPoetryCouplet when text is selected outside a block', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const first = $createTextNode('one');
        const last = $createTextNode('two');
        $getRoot().append($createParagraphNode().append(first), $createParagraphNode().append(last));
        $selectAcross(first, last);
        expect($insertPoetryCouplet('two-column')).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      // Conversion is always single-column, whatever the toolbar's default layout.
      expect(getBlock().getLayout()).toBe('single');
    });
    expect(misraTexts(editor)).toEqual(['one', 'two']);
  });

  it('changes nothing for a collapsed selection, a selection inside a block, or whitespace-only text', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => expect($convertSelectionToPoetry()).toBe(false));
    editor.update(
      () => {
        const only = $createTextNode('   ');
        $getRoot().clear().append($createParagraphNode().append(only));
        $selectAcross(only, only);
        expect($convertSelectionToPoetry()).toBe(false);
        expect($getRoot().getChildrenSize()).toBe(1);
      },
      { discrete: true },
    );
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        const misra = $getMisraParagraphs(getBlock())[0];
        const text = $createTextNode('inside');
        misra.append(text);
        $selectAcross(text, text);
        expect($convertSelectionToPoetry()).toBe(false);
      },
      { discrete: true },
    );
  });
});

describe('$getCoupletFromSelection', () => {
  it('returns the caret couplet in either layout and null outside a block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      expect($getCoupletFromSelection()).toBeNull();
      // Couplet tuples are built afresh per call, so compare by misra key.
      const coupletIndex = () => $getCouplets(getBlock()).findIndex(([a]) => a.getKey() === $getCoupletFromSelection()?.[0].getKey());
      $insertPoetryCouplet('two-column');
      expect(coupletIndex()).toBe(0);
      $insertCoupletRelativeToSelection('after'); // caret moves into the new second couplet
      expect(coupletIndex()).toBe(1);
    });
  });
});

/** A block with couplets ['a1','a2'], ['b1','b2'], ['c1','c2'] after a 'hello' paragraph. */
function buildThreeCoupletBlock(editor: LexicalEditor, layout: 'single' | 'two-column' = 'single'): void {
  withCaretInParagraph(editor, () => {
    $insertPoetryCouplet(layout);
    const block = getBlock();
    $getMisraParagraphs(block)[0].append($createTextNode('a1'));
    $getMisraParagraphs(block)[1].append($createTextNode('a2'));
    for (const [x, y] of [['b1', 'b2'], ['c1', 'c2']]) {
      const lines = $getMisraParagraphs(block);
      lines[lines.length - 1].selectEnd();
      $exitPoetryOnEnter();
      const misras = $getMisraParagraphs(block);
      misras[misras.length - 2].append($createTextNode(x));
      misras[misras.length - 1].append($createTextNode(y));
    }
  });
}

const misraByText = (text: string) => $getMisraParagraphs(getBlock()).find((p) => p.getTextContent() === text)!;

describe('$moveCouplet', () => {
  it('moves a couplet before or after another in the same single-column block', () => {
    const editor = makeEditor();
    buildThreeCoupletBlock(editor);
    editor.update(
      () => {
        const c = $getCoupletContaining(misraByText('c1'))!;
        const a = $getCoupletContaining(misraByText('a1'))!;
        expect($moveCouplet(c.couplet, { kind: 'couplet', couplet: a.couplet, position: 'before' })).toBe(true);
      },
      { discrete: true },
    );
    expect(misraTexts(editor)).toEqual(['c1', 'c2', 'a1', 'a2', 'b1', 'b2']);
    editor.update(
      () => {
        const c = $getCoupletContaining(misraByText('c1'))!;
        const b = $getCoupletContaining(misraByText('b1'))!;
        expect($moveCouplet(c.couplet, { kind: 'couplet', couplet: b.couplet, position: 'after' })).toBe(true);
        expect($getCoupletFromSelection()?.[0].getTextContent()).toBe('c1');
      },
      { discrete: true },
    );
    expect(misraTexts(editor)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
  });

  it('rebuilds the couplet for a two-column block, and removes a source block left empty', () => {
    const editor = makeEditor();
    buildThreeCoupletBlock(editor, 'two-column');
    editor.update(
      () => {
        // Split the last couplet out as its own (two-column) block after the 'hello' paragraph...
        const c = $getCoupletContaining(misraByText('c1'))!;
        const hello = $getRoot().getFirstChild()!;
        expect($moveCouplet(c.couplet, { kind: 'block', block: hello, position: 'after' })).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const blocks = $getRoot().getChildren().filter($isPoetryBlockNode);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].getLayout()).toBe('two-column');
      expect($getCouplets(blocks[0]).map(([a, b]) => [a.getTextContent(), b.getTextContent()])).toEqual([['c1', 'c2']]);
      expect($getCouplets(blocks[1])).toHaveLength(2);
      expect(blocks[0].getNextSibling()?.is(blocks[1])).toBe(true);
    });
    editor.update(
      () => {
        // ...then move both remaining couplets into it; the emptied source block goes away.
        const [first, second] = $getRoot().getChildren().filter($isPoetryBlockNode);
        const target = $getCouplets(first)[0];
        for (const couplet of $getCouplets(second)) {
          expect($moveCouplet(couplet, { kind: 'couplet', couplet: target, position: 'before' })).toBe(true);
        }
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const blocks = $getRoot().getChildren().filter($isPoetryBlockNode);
      expect(blocks).toHaveLength(1);
      expect($getCouplets(blocks[0]).map(([a, b]) => [a.getTextContent(), b.getTextContent()])).toEqual([
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
      ]);
      expect(blocks[0].getChildren().every((row) => row.getType() === 'layout-container')).toBe(true);
    });
  });

  it('refuses to move a couplet onto itself, or a lone couplet beside its own block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      $insertPoetryCouplet('single');
      const block = getBlock();
      const couplet = $getCouplets(block)[0];
      expect($moveCouplet(couplet, { kind: 'couplet', couplet, position: 'after' })).toBe(false);
      expect($moveCouplet(couplet, { kind: 'block', block, position: 'after' })).toBe(false);
      expect($getRoot().getChildren().filter($isPoetryBlockNode)).toHaveLength(1);
    });
  });
});

describe('$swapMisras', () => {
  it('exchanges two lines within and across couplets, keeping every couplet two lines long', () => {
    const editor = makeEditor();
    buildThreeCoupletBlock(editor);
    editor.update(() => expect($swapMisras(misraByText('a1'), misraByText('a2'))).toBe(true), { discrete: true });
    expect(misraTexts(editor)).toEqual(['a2', 'a1', 'b1', 'b2', 'c1', 'c2']);
    editor.update(() => expect($swapMisras(misraByText('a1'), misraByText('c2'))).toBe(true), { discrete: true });
    expect(misraTexts(editor)).toEqual(['a2', 'c2', 'b1', 'b2', 'c1', 'a1']);
    editor.getEditorState().read(() => expect($getCouplets(getBlock())).toHaveLength(3));
  });

  it('works in a two-column block and is a no-op on the same line', () => {
    const editor = makeEditor();
    buildThreeCoupletBlock(editor, 'two-column');
    editor.update(
      () => {
        expect($swapMisras(misraByText('b1'), misraByText('b1'))).toBe(false);
        expect($swapMisras(misraByText('a2'), misraByText('b1'))).toBe(true);
      },
      { discrete: true },
    );
    expect(misraTexts(editor)).toEqual(['a1', 'b1', 'a2', 'b2', 'c1', 'c2']);
  });
});

describe('musaddas and mukhammas layouts (lexical-editor-spec.md §4.11, amended)', () => {
  it('inserts a musaddas block with six empty misras in a single stanza, flat single-column', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('musaddas');
      expect($getMisraParagraphs(block)).toHaveLength(6);
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
  });

  it('inserts a mukhammas block with five empty misras, flat single-column', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('mukhammas'));
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('mukhammas');
      expect($getMisraParagraphs(block)).toHaveLength(5);
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
  });

  it('Enter at the end of a non-empty last stanza appends a whole new empty stanza, not a single misra', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[5].append($createTextNode('line six'));
        misras[5].selectEnd();
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
      expect($getMisraParagraphs(block)).toHaveLength(12);
    });
  });

  it('Backspace on an all-empty stanza removes the whole stanza, keeping earlier ones intact', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('mukhammas'));
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[0].append($createTextNode('a1'));
        misras[4].selectEnd();
        $exitPoetryOnEnter(); // appends a second, empty 5-line stanza
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[5].selectStart(); // start of the second stanza's first misra
        expect($deletePoetryOnBackspace()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1);
      expect($getMisraParagraphs(block)).toHaveLength(5);
    });
    expect(misraTexts(editor)).toEqual(['a1', '', '', '', '']);
  });

  it('$completeSingleCoupletBlock pads to a full stanza, not just an even count', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(
      () => {
        const block = getBlock();
        block.append($createParagraphNode()); // 7 children: one short of a second 6-line stanza
        $completeSingleCoupletBlock(block);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => expect($getMisraParagraphs(getBlock())).toHaveLength(12));
  });
});

describe('$setPoetryLayout re-chunking across stanza sizes', () => {
  it('re-chunks 6 misras in single into 3 couplet rows when switching to two-column', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        ['a', 'b', 'c', 'd', 'e', 'f'].forEach((t, i) => misras[i].append($createTextNode(t)));
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
      expect($getCouplets(block)).toHaveLength(3);
      expect(block.getChildren().every((c) => c.getType() === 'layout-container')).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('pads 4 misras in single out to a full 6-line musaddas stanza when switching to musaddas', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        const block = getBlock();
        $getMisraParagraphs(block)[0].selectStart();
        $insertCoupletRelativeToSelection('after'); // 4 misras total, 2 couplets
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        ['a', 'b', 'c', 'd'].forEach((t, i) => misras[i].append($createTextNode(t)));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'musaddas');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('musaddas');
      expect($getCouplets(block)).toHaveLength(1);
      expect($getMisraParagraphs(block)).toHaveLength(6);
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', '', '']);
  });

  it('re-chunks a two-column block into a single mukhammas stanza, padding the short remainder', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('two-column'));
    editor.update(
      () => {
        const [a, b] = $getMisraParagraphs(getBlock());
        a.append($createTextNode('x'));
        b.append($createTextNode('y'));
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'mukhammas');
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('mukhammas');
      expect($getCouplets(block)).toHaveLength(1);
      expect($getMisraParagraphs(block)).toHaveLength(5);
    });
    expect(misraTexts(editor)).toEqual(['x', 'y', '', '', '']);
  });

  it('clears autoWidth when switching from single to two-column, but keeps it when switching to musaddas/mukhammas', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        getBlock().getFirstChild()!.selectStart();
        $setPoetryAutoWidth(true);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'musaddas');
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => expect(getBlock().getAutoWidth()).toBe(true));
    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'two-column');
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => expect(getBlock().getAutoWidth()).toBe(false));
  });
});

describe('$convertSelectionToPoetry layouts', () => {
  it('pads a short selection out to a full musaddas stanza (6 lines)', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const first = $createTextNode('one');
        const second = $createTextNode('two');
        const third = $createTextNode('three');
        $getRoot().append(
          $createParagraphNode().append(first),
          $createParagraphNode().append(second),
          $createParagraphNode().append(third),
        );
        $selectAcross(first, third);
        expect($convertSelectionToPoetry('musaddas')).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('musaddas');
      expect($getMisraParagraphs(block)).toHaveLength(6);
    });
    expect(misraTexts(editor)).toEqual(['one', 'two', 'three', '', '', '']);
  });

  it('falls back to single-column when two-column/staggered is requested for a selection conversion', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const first = $createTextNode('a');
        const second = $createTextNode('b');
        $getRoot().append($createParagraphNode().append(first), $createParagraphNode().append(second));
        $selectAcross(first, second);
        expect($insertPoetryCouplet('two-column')).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      // Conversion is always single-column-shaped, whatever layout was requested.
      expect(getBlock().getLayout()).toBe('single');
    });
    expect(misraTexts(editor)).toEqual(['a', 'b']);
  });

  it('threads mukhammas through $insertPoetryCouplet when text is selected outside a block', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const first = $createTextNode('a');
        const second = $createTextNode('b');
        $getRoot().append($createParagraphNode().append(first), $createParagraphNode().append(second));
        $selectAcross(first, second);
        expect($insertPoetryCouplet('mukhammas')).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('mukhammas');
      expect($getMisraParagraphs(block)).toHaveLength(5);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', '', '', '']);
  });
});

describe('PoetryBlockNode autoWidth (request 2)', () => {
  it('defaults to false and round-trips through JSON and DOM', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getAutoWidth()).toBe(false);
      expect(block.exportJSON().autoWidth).toBe(false);
      expect((block.exportDOM().element as HTMLElement).getAttribute('data-likhari-poetry-auto-width')).toBe('false');
    });
  });

  it('$setPoetryAutoWidth turns it on in single layout and round-trips through JSON/DOM', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        getBlock().getFirstChild()!.selectStart();
        expect($setPoetryAutoWidth(true)).toBe(true);
      },
      { discrete: true },
    );
    let json: ReturnType<PoetryBlockNode['exportJSON']>;
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getAutoWidth()).toBe(true);
      json = block.exportJSON();
      expect(json.autoWidth).toBe(true);
      expect((block.exportDOM().element as HTMLElement).getAttribute('data-likhari-poetry-auto-width')).toBe('true');
    });
    editor.update(
      () => {
        const restored = PoetryBlockNode.importJSON(json);
        expect(restored.getAutoWidth()).toBe(true);
      },
      { discrete: true },
    );
  });

  it('is accepted for musaddas and mukhammas too, not just single', () => {
    for (const layout of ['musaddas', 'mukhammas'] as const) {
      const editor = makeEditor();
      withCaretInParagraph(editor, () => $insertPoetryCouplet(layout));
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          expect($setPoetryAutoWidth(true)).toBe(true);
        },
        { discrete: true },
      );
      editor.getEditorState().read(() => expect(getBlock().getAutoWidth()).toBe(true));
    }
  });

  it('is refused outside the single-column-shaped layouts (two-column, staggered)', () => {
    for (const layout of ['two-column', 'staggered'] as const) {
      const editor = makeEditor();
      withCaretInParagraph(editor, () => $insertPoetryCouplet(layout));
      let result = true;
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          result = $setPoetryAutoWidth(true);
        },
        { discrete: true },
      );
      expect(result).toBe(false);
      editor.getEditorState().read(() => expect(getBlock().getAutoWidth()).toBe(false));
    }
  });

  it('is forced back off when the layout changes to two-column/staggered', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    editor.update(
      () => {
        getBlock().getFirstChild()!.selectStart();
        $setPoetryAutoWidth(true);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $setPoetryLayout(getBlock(), 'two-column');
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => expect(getBlock().getAutoWidth()).toBe(false));
  });

  it('PoetryBlockNode.importJSON ignores a hand-edited autoWidth when layout is not single', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const block = PoetryBlockNode.importJSON({
          type: 'poetry-couplet',
          version: 1,
          layout: 'two-column',
          autoWidth: true,
          children: [],
          direction: null,
          format: '',
          indent: 0,
        });
        expect(block.getAutoWidth()).toBe(false);
      },
      { discrete: true },
    );
  });
});

describe('PoetryBlockNode staggerGroup (request 3)', () => {
  it('defaults to 1 and round-trips through JSON and DOM', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('staggered'));
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getStaggerGroup()).toBe(1);
      expect(block.exportJSON().staggerGroup).toBe(1);
      expect((block.exportDOM().element as HTMLElement).getAttribute('data-likhari-poetry-stagger-group')).toBe('1');
    });
  });

  it('$setPoetryStaggerGroup sets it to 2 only while staggered, and round-trips through JSON', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('staggered'));
    editor.update(
      () => {
        getBlock().getFirstChild()!.selectStart();
        expect($setPoetryStaggerGroup(2)).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getStaggerGroup()).toBe(2);
      expect(block.exportJSON().staggerGroup).toBe(2);
      expect((block.exportDOM().element as HTMLElement).getAttribute('data-likhari-poetry-stagger-group')).toBe('2');
    });
  });

  it('is refused outside staggered layout', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('single'));
    let result = true;
    editor.update(
      () => {
        getBlock().getFirstChild()!.selectStart();
        result = $setPoetryStaggerGroup(2);
      },
      { discrete: true },
    );
    expect(result).toBe(false);
  });

  it('PoetryBlockNode.importJSON falls back to 1 for an invalid staggerGroup', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const block = PoetryBlockNode.importJSON({
          type: 'poetry-couplet',
          version: 1,
          layout: 'staggered',
          staggerGroup: 3 as unknown as 1,
          children: [],
          direction: null,
          format: '',
          indent: 0,
        });
        expect(block.getStaggerGroup()).toBe(1);
      },
      { discrete: true },
    );
  });
});

/** Same as makeEditor(), but attached to a real (jsdom) root element, so
 * createDOM/updateDOM actually run and editor.getElementByKey can inspect
 * the rendered class list — mirrors LayoutNode.test.ts's own pattern. */
function makeEditorWithRoot(): LexicalEditor {
  const editor = makeEditor();
  editor.setRootElement(document.createElement('div'));
  return editor;
}

describe('PoetryBlockNode stanzaVariant (lexical-editor-spec.md §4.11, further amended)', () => {
  it('defaults to continuous for musaddas/mukhammas and round-trips through JSON and DOM', () => {
    for (const layout of ['musaddas', 'mukhammas'] as const) {
      const editor = makeEditor();
      withCaretInParagraph(editor, () => $insertPoetryCouplet(layout));
      editor.getEditorState().read(() => {
        const block = getBlock();
        expect(block.getStanzaVariant()).toBe('continuous');
        expect(block.exportJSON().stanzaVariant).toBe('continuous');
        expect((block.exportDOM().element as HTMLElement).getAttribute('data-likhari-poetry-stanza-variant')).toBe('continuous');
      });
    }
  });

  it('always reads back continuous for single/two-column/staggered, even with a hand-edited JSON value', () => {
    for (const layout of ['single', 'two-column', 'staggered'] as const) {
      const editor = makeEditor();
      editor.update(
        () => {
          const block = PoetryBlockNode.importJSON({
            type: 'poetry-couplet',
            version: 1,
            layout,
            stanzaVariant: 'mixed' as unknown as 'continuous',
            children: [],
            direction: null,
            format: '',
            indent: 0,
          });
          expect(block.getStanzaVariant()).toBe('continuous');
        },
        { discrete: true },
      );
    }
  });

  it('$setPoetryStanzaVariant sets split, applies the CSS modifier class, and round-trips through JSON/DOM, for both musaddas and mukhammas', () => {
    for (const layout of ['musaddas', 'mukhammas'] as const) {
      const editor = makeEditorWithRoot();
      let key = '';
      withCaretInParagraph(editor, () => $insertPoetryCouplet(layout));
      editor.update(
        () => {
          const block = getBlock();
          key = block.getKey();
          block.getFirstChild()!.selectStart();
          expect($setPoetryStanzaVariant('split')).toBe(true);
        },
        { discrete: true },
      );
      expect(editor.getElementByKey(key)!.classList.contains('likhari-poetry--variant-split')).toBe(true);
      expect(editor.getElementByKey(key)!.classList.contains('likhari-poetry--variant-continuous')).toBe(false);

      let json!: ReturnType<PoetryBlockNode['exportJSON']>;
      editor.getEditorState().read(() => {
        const block = getBlock();
        expect(block.getStanzaVariant()).toBe('split');
        json = block.exportJSON();
        expect(json.stanzaVariant).toBe('split');
        expect((block.exportDOM().element as HTMLElement).getAttribute('data-likhari-poetry-stanza-variant')).toBe('split');
      });
      editor.update(
        () => {
          const restored = PoetryBlockNode.importJSON(json);
          expect(restored.getStanzaVariant()).toBe('split');
        },
        { discrete: true },
      );
    }
  });

  it('is refused outside musaddas/mukhammas', () => {
    for (const layout of ['single', 'two-column', 'staggered'] as const) {
      const editor = makeEditor();
      withCaretInParagraph(editor, () => $insertPoetryCouplet(layout));
      let result = true;
      editor.update(
        () => {
          getBlock().getFirstChild()!.selectStart();
          result = $setPoetryStanzaVariant('split');
        },
        { discrete: true },
      );
      expect(result).toBe(false);
      editor.getEditorState().read(() => expect(getBlock().getStanzaVariant()).toBe('continuous'));
    }
  });

  it('is a no-op (returns true, nothing rebuilt) when already in the requested variant', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    let firstChildKey = '';
    editor.update(() => {
      const block = getBlock();
      firstChildKey = block.getFirstChild()!.getKey();
      block.getFirstChild()!.selectStart();
      expect($setPoetryStanzaVariant('continuous')).toBe(true);
    }, { discrete: true });
    editor.getEditorState().read(() => {
      expect(getBlock().getFirstChild()!.getKey()).toBe(firstChildKey);
    });
  });
});

describe('stanzaVariant "mixed" physical shape', () => {
  it('builds 2 two-column rows + a centered trailing group for musaddas (4+2) — centered by default', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        ['a', 'b', 'c', 'd', 'e', 'f'].forEach((t, i) => misras[i].append($createTextNode(t)));
        getBlock().getFirstChild()!.selectStart();
        expect($setPoetryStanzaVariant('mixed')).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      const children = block.getChildren();
      // The trailing 2 misras share one centered layout-container, not two
      // bare paragraphs — mixed defaults to centered ($buildCoupletNodes).
      expect(children.map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      expect($getCouplets(block)).toHaveLength(1);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('builds 2 two-column rows + 1 centered trailing line for mukhammas (4+1) — centered by default', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('mukhammas'));
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        ['a', 'b', 'c', 'd', 'e'].forEach((t, i) => misras[i].append($createTextNode(t)));
        getBlock().getFirstChild()!.selectStart();
        expect($setPoetryStanzaVariant('mixed')).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      const children = block.getChildren();
      // The trailing slot is a centered layout-container, not a bare
      // paragraph — mukhammas-mixed defaults to centered ($buildCoupletNodes).
      expect(children.map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
      expect($getCouplets(block)).toHaveLength(1);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('repeats the pattern across multiple stanzas, in order', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      $insertPoetryCouplet('mukhammas');
      const misras = $getMisraParagraphs(getBlock());
      ['a1', 'a2', 'a3', 'a4', 'a5'].forEach((t, i) => misras[i].append($createTextNode(t)));
      misras[4].selectEnd();
      $exitPoetryOnEnter(); // appends a second, empty 5-line stanza
      const second = $getMisraParagraphs(getBlock()).slice(5);
      ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((t, i) => second[i].append($createTextNode(t)));
      getBlock().getFirstChild()!.selectStart();
      $setPoetryStanzaVariant('mixed');
    });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getChildren().map((c) => c.getType())).toEqual([
        'layout-container', 'layout-container', 'layout-container',
        'layout-container', 'layout-container', 'layout-container',
      ]);
      expect($getCouplets(block)).toHaveLength(2);
    });
    expect(misraTexts(editor)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5']);
  });

  it('applies the likhari-poetry--variant-mixed CSS modifier class', () => {
    const editor = makeEditorWithRoot();
    let key = '';
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(() => {
      const block = getBlock();
      key = block.getKey();
      block.getFirstChild()!.selectStart();
      $setPoetryStanzaVariant('mixed');
    }, { discrete: true });
    expect(editor.getElementByKey(key)!.classList.contains('likhari-poetry--variant-mixed')).toBe(true);
  });
});

describe('$setPoetryStanzaVariant conversions preserve content', () => {
  it('round-trips continuous -> split -> mixed -> continuous, keeping every misra\'s text, for musaddas', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(() => {
      const misras = $getMisraParagraphs(getBlock());
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((t, i) => misras[i].append($createTextNode(t)));
    }, { discrete: true });

    const texts = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (const variant of ['split', 'mixed', 'continuous'] as const) {
      editor.update(() => {
        getBlock().getFirstChild()!.selectStart();
        expect($setPoetryStanzaVariant(variant)).toBe(true);
      }, { discrete: true });
      editor.getEditorState().read(() => expect(getBlock().getStanzaVariant()).toBe(variant));
      expect(misraTexts(editor)).toEqual(texts);
    }
  });

  it('round-trips continuous -> mixed -> split -> continuous, keeping every misra\'s text, for mukhammas', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('mukhammas'));
    editor.update(() => {
      const misras = $getMisraParagraphs(getBlock());
      ['a', 'b', 'c', 'd', 'e'].forEach((t, i) => misras[i].append($createTextNode(t)));
    }, { discrete: true });

    const texts = ['a', 'b', 'c', 'd', 'e'];
    for (const variant of ['mixed', 'split', 'continuous'] as const) {
      editor.update(() => {
        getBlock().getFirstChild()!.selectStart();
        expect($setPoetryStanzaVariant(variant)).toBe(true);
      }, { discrete: true });
      editor.getEditorState().read(() => expect(getBlock().getStanzaVariant()).toBe(variant));
      expect(misraTexts(editor)).toEqual(texts);
    }
  });
});

describe('stanzaVariant forced back to continuous on layout change', () => {
  it('$setPoetryLayout forces stanzaVariant back to continuous when moving away from musaddas/mukhammas', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(() => {
      getBlock().getFirstChild()!.selectStart();
      $setPoetryStanzaVariant('mixed');
    }, { discrete: true });
    editor.update(() => {
      $setPoetryLayout(getBlock(), 'single');
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getStanzaVariant()).toBe('continuous');
      expect(block.getChildren().every((c) => c.getType() === 'paragraph')).toBe(true);
    });
  });

  it('keeps a mixed stanzaVariant, rebuilt at the new stanza size, when moving between musaddas and mukhammas', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertPoetryCouplet('musaddas'));
    editor.update(() => {
      const misras = $getMisraParagraphs(getBlock());
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((t, i) => misras[i].append($createTextNode(t)));
      getBlock().getFirstChild()!.selectStart();
      $setPoetryStanzaVariant('mixed');
    }, { discrete: true });
    editor.update(() => {
      $setPoetryLayout(getBlock(), 'mukhammas');
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect(block.getLayout()).toBe('mukhammas');
      expect(block.getStanzaVariant()).toBe('mixed');
      // Re-chunked to mukhammas' own 5-line stanza size: the former 6th
      // misra ('f') pads out a second (new, empty) 5-line stanza instead —
      // each mukhammas-mixed stanza is 2 rows + 1 trailing flat (3 physical
      // children), so 2 stanzas is 6 children total. The trailing slot is a
      // centered layout-container, not a bare paragraph — mukhammas-mixed
      // defaults to centered ($buildCoupletNodes), including when rebuilt by
      // a layout change.
      expect(block.getChildren().map((c) => c.getType())).toEqual([
        'layout-container', 'layout-container', 'layout-container',
        'layout-container', 'layout-container', 'layout-container',
      ]);
      expect($getCouplets(block)).toHaveLength(2);
    });
  });
});

describe('editing interactions on a mixed-variant stanza', () => {
  function buildMixedMusaddas(editor: LexicalEditor): void {
    withCaretInParagraph(editor, () => {
      $insertPoetryCouplet('musaddas');
      const misras = $getMisraParagraphs(getBlock());
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((t, i) => misras[i].append($createTextNode(t)));
      getBlock().getFirstChild()!.selectStart();
      $setPoetryStanzaVariant('mixed');
    });
  }

  it('Enter at the end of a non-empty mixed stanza appends a whole new mixed-shaped stanza', () => {
    const editor = makeEditor();
    buildMixedMusaddas(editor);
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[5].selectEnd(); // end of 'f', the last trailing flat misra
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
      // Each stanza's 2 trailing misras share one centered layout-container
      // by default, not two bare paragraphs.
      expect(block.getChildren().map((c) => c.getType())).toEqual([
        'layout-container', 'layout-container', 'layout-container',
        'layout-container', 'layout-container', 'layout-container',
      ]);
    });
  });

  it('Enter at the boundary between the 2-column rows and the trailing flats just moves the caret, inserting nothing', () => {
    const editor = makeEditor();
    buildMixedMusaddas(editor);
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[3].selectEnd(); // end of 'd' — last misra of the 2-column section
        expect($exitPoetryOnEnter()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1); // nothing inserted
      // selectEnd() on a non-empty paragraph lands on its text child, not
      // the paragraph itself — check containment, not an exact key match.
      const nextMisra = $getMisraParagraphs(block)[4]; // 'e', the first trailing flat misra
      const selection = $getSelection();
      const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
      expect(anchorNode !== null && (nextMisra.getKey() === anchorNode.getKey() || nextMisra.isParentOf(anchorNode))).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('Backspace at the start of the first trailing flat line moves to the end of the 2-column section, without merging', () => {
    const editor = makeEditor();
    buildMixedMusaddas(editor);
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[4].selectStart(); // start of 'e', the first trailing flat misra
        expect($deletePoetryOnBackspace()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      // selectEnd() on a non-empty paragraph lands on its text child, not
      // the paragraph itself — check containment, not an exact key match
      // (same caveat the pre-existing "merges an empty couplet" test above notes).
      const lastOfRows = $getMisraParagraphs(getBlock())[3]; // 'd', last misra of the 2-column section
      const selection = $getSelection();
      const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
      expect(anchorNode !== null && (lastOfRows.getKey() === anchorNode.getKey() || lastOfRows.isParentOf(anchorNode))).toBe(true);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('Backspace on an all-empty mixed stanza removes its 2 rows AND its trailing flats together, keeping the previous stanza intact', () => {
    const editor = makeEditor();
    buildMixedMusaddas(editor);
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[5].selectEnd();
        $exitPoetryOnEnter(); // appends a second, empty mixed stanza
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[6].selectStart(); // start of the second stanza's first misra
        expect($deletePoetryOnBackspace()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
    });
    expect(misraTexts(editor)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('$deletePoetryCouplet removes a whole mixed stanza (both rows and its trailing flats)', () => {
    const editor = makeEditor();
    buildMixedMusaddas(editor);
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[5].selectEnd();
        $exitPoetryOnEnter(); // second, empty mixed stanza
        const second = $getMisraParagraphs(getBlock()).slice(6);
        ['g', 'h', 'i', 'j', 'k', 'l'].forEach((t, i) => second[i].append($createTextNode(t)));
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $getMisraParagraphs(getBlock())[0].selectStart(); // caret in the first stanza
        expect($deletePoetryCouplet()).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(1);
      expect(block.getChildren().map((c) => c.getType())).toEqual(['layout-container', 'layout-container', 'layout-container']);
    });
    expect(misraTexts(editor)).toEqual(['g', 'h', 'i', 'j', 'k', 'l']);
  });

  it('$moveCouplet moves a whole mixed stanza (both rows and its trailing flats) within the same block', () => {
    const editor = makeEditor();
    buildMixedMusaddas(editor);
    editor.update(
      () => {
        const misras = $getMisraParagraphs(getBlock());
        misras[5].selectEnd();
        $exitPoetryOnEnter(); // second, empty mixed stanza
        const second = $getMisraParagraphs(getBlock()).slice(6);
        ['g', 'h', 'i', 'j', 'k', 'l'].forEach((t, i) => second[i].append($createTextNode(t)));
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const block = getBlock();
        const second = $getCouplets(block)[1];
        const first = $getCouplets(block)[0];
        expect($moveCouplet(second, { kind: 'couplet', couplet: first, position: 'before' })).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const block = getBlock();
      expect($getCouplets(block)).toHaveLength(2);
      // Centering is preserved across the move ($detachCouplet/$moveCouplet).
      expect(block.getChildren().map((c) => c.getType())).toEqual([
        'layout-container', 'layout-container', 'layout-container',
        'layout-container', 'layout-container', 'layout-container',
      ]);
    });
    expect(misraTexts(editor)).toEqual(['g', 'h', 'i', 'j', 'k', 'l', 'a', 'b', 'c', 'd', 'e', 'f']);
  });
});
