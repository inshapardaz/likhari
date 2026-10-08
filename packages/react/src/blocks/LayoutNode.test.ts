import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $getRoot, $isElementNode, createEditor, type LexicalEditor } from 'lexical';
import { $createLayoutContainerNode, $createLayoutItemNode, $isLayoutContainerNode, LayoutContainerNode, LayoutItemNode } from './LayoutNode';

function makeEditor(): LexicalEditor {
  const editor = createEditor({ nodes: [LayoutContainerNode, LayoutItemNode], onError: (error) => { throw error; } });
  editor.setRootElement(document.createElement('div'));
  return editor;
}

describe('LayoutContainerNode DOM', () => {
  it('marks a single-item row for CSS, instead of a :has() selector (issue #25)', () => {
    const editor = makeEditor();
    let key = '';
    editor.update(
      () => {
        const container = $createLayoutContainerNode('1fr');
        container.append($createLayoutItemNode().append($createParagraphNode()));
        $getRoot().append(container);
        key = container.getKey();
      },
      { discrete: true },
    );
    expect(editor.getElementByKey(key)!.hasAttribute('data-likhari-single-column')).toBe(true);
  });

  it('does not mark a two-item row', () => {
    const editor = makeEditor();
    let key = '';
    editor.update(
      () => {
        const container = $createLayoutContainerNode('repeat(2, 1fr)');
        container.append($createLayoutItemNode().append($createParagraphNode()), $createLayoutItemNode().append($createParagraphNode()));
        $getRoot().append(container);
        key = container.getKey();
      },
      { discrete: true },
    );
    expect(editor.getElementByKey(key)!.hasAttribute('data-likhari-single-column')).toBe(false);
  });

  it('updates the attribute when a row goes from two items to one', () => {
    const editor = makeEditor();
    let key = '';
    editor.update(
      () => {
        const container = $createLayoutContainerNode('repeat(2, 1fr)');
        container.append($createLayoutItemNode().append($createParagraphNode()), $createLayoutItemNode().append($createParagraphNode()));
        $getRoot().append(container);
        key = container.getKey();
      },
      { discrete: true },
    );
    editor.update(
      () => {
        const root = $getRoot().getFirstChild();
        if (!$isElementNode(root) || !$isLayoutContainerNode(root)) return;
        root.getChildren()[1]!.remove();
        root.setTemplateColumns('1fr');
      },
      { discrete: true },
    );
    expect(editor.getElementByKey(key)!.hasAttribute('data-likhari-single-column')).toBe(true);
  });
});
