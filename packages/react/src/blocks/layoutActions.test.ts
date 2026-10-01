import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import {
  $createLayoutContainerNode,
  $createLayoutItemNode,
  $isLayoutContainerNode,
  $isLayoutItemNode,
  LayoutContainerNode,
  LayoutItemNode,
} from './LayoutNode';
import { $insertLayout, $normalizeLayoutContainer, $normalizeLayoutItem } from './layoutActions';

function makeEditor(): LexicalEditor {
  const editor = createEditor({ namespace: 'test', nodes: [LayoutContainerNode, LayoutItemNode], onError: (e) => { throw e; } });
  editor.registerNodeTransform(LayoutItemNode, $normalizeLayoutItem);
  editor.registerNodeTransform(LayoutContainerNode, $normalizeLayoutContainer);
  return editor;
}

const containerCount = (editor: LexicalEditor): number =>
  editor.getEditorState().read(() => $getRoot().getChildren().filter($isLayoutContainerNode).length);

const itemCounts = (editor: LexicalEditor): number[] =>
  editor.getEditorState().read(() => {
    const container = $getRoot().getChildren().find($isLayoutContainerNode);
    return container ? container.getChildren().filter($isLayoutItemNode).map((item) => item.getChildrenSize()) : [];
  });

/** Seeds a paragraph, parks the caret in it, then runs `action` — all in one
 * update, since a caret doesn't survive between updates of a DOM-less editor. */
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

describe('$insertLayout', () => {
  it('inserts a container with one empty-paragraph item per column, after the caret block', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertLayout(3));

    expect(containerCount(editor)).toBe(1);
    expect(itemCounts(editor)).toEqual([1, 1, 1]);
    editor.getEditorState().read(() => {
      const container = $getRoot().getChildren().find($isLayoutContainerNode);
      expect(container?.getTemplateColumns()).toBe('repeat(3, 1fr)');
      // Inserted after the caret's paragraph, not before or replacing it.
      expect($getRoot().getChildren()[0].getType()).toBe('paragraph');
    });
  });

  it('clamps column count to the 2-6 range', () => {
    const low = makeEditor();
    withCaretInParagraph(low, () => $insertLayout(1));
    expect(itemCounts(low)).toEqual([1, 1]);

    const high = makeEditor();
    withCaretInParagraph(high, () => $insertLayout(99));
    expect(itemCounts(high)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('does nothing without a usable selection', () => {
    const editor = makeEditor();
    editor.update(() => {
      const inserted = $insertLayout(2);
      expect(inserted).toBe(false);
    });
    expect(containerCount(editor)).toBe(0);
  });
});

describe('layout node transforms', () => {
  it('unwraps a LayoutItemNode whose parent is not a LayoutContainerNode', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const orphan = $createLayoutItemNode().append($createParagraphNode().append($createTextNode('stray')));
        $getRoot().append(orphan);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some((n) => n.getType() === 'layout-item')).toBe(false);
      expect($getRoot().getTextContent()).toContain('stray');
    });
  });

  it('removes a LayoutContainerNode left with no items', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const container = $createLayoutContainerNode('repeat(2, 1fr)');
        container.append($createLayoutItemNode().append($createParagraphNode()));
        $getRoot().append(container);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const container = $getRoot().getChildren().find($isLayoutContainerNode);
        container?.getFirstChild()?.remove();
      },
      { discrete: true },
    );
    expect(containerCount(editor)).toBe(0);
  });

  it('drops a non-LayoutItemNode child of a LayoutContainerNode', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        const container = $createLayoutContainerNode('repeat(2, 1fr)');
        container.append($createLayoutItemNode().append($createParagraphNode()));
        $getRoot().append(container);
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const container = $getRoot().getChildren().find($isLayoutContainerNode)!;
        // Splice in a loose paragraph directly under the container — something
        // no insert path produces, but paste/undo could.
        container.append($createParagraphNode().append($createTextNode('loose')));
      },
      { discrete: true },
    );
    expect(itemCounts(editor).length).toBe(1);
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).not.toContain('loose');
    });
  });
});
