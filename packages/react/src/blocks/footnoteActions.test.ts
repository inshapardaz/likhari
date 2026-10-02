import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { $isFootnoteReferenceNode, FootnoteReferenceNode } from './FootnoteNode';
import { $isFootnoteItemNode, $isFootnoteListNode, FootnoteItemNode, FootnoteListNode } from './FootnoteListNode';
import { $insertFootnote, $removeFootnoteItem } from './footnoteActions';

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: 'test',
    nodes: [FootnoteReferenceNode, FootnoteListNode, FootnoteItemNode],
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

const referenceIds = (editor: LexicalEditor): string[] =>
  editor.getEditorState().read(() => {
    const ids: string[] = [];
    const collect = (node: ReturnType<typeof $getRoot>) => {
      node.getChildren().forEach((child) => {
        if ($isFootnoteReferenceNode(child)) ids.push(child.getFootnoteId());
        else if ('getChildren' in child) collect(child as ReturnType<typeof $getRoot>);
      });
    };
    collect($getRoot());
    return ids;
  });

const listItemIds = (editor: LexicalEditor): string[] =>
  editor.getEditorState().read(() => {
    const list = $getRoot().getChildren().find($isFootnoteListNode);
    return list ? list.getChildren().filter($isFootnoteItemNode).map((item) => item.getFootnoteId()) : [];
  });

describe('$insertFootnote', () => {
  it('inserts a reference at the caret and a matching item in a new footnote list', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertFootnote());

    const refs = referenceIds(editor);
    const items = listItemIds(editor);
    expect(refs).toHaveLength(1);
    expect(items).toEqual(refs);
  });

  it('appends later footnotes to the same list, in insertion order', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      $insertFootnote();
      $insertFootnote();
    });

    expect(referenceIds(editor)).toHaveLength(2);
    expect(listItemIds(editor)).toEqual(referenceIds(editor));

    editor.getEditorState().read(() => {
      const lists = $getRoot().getChildren().filter($isFootnoteListNode);
      expect(lists).toHaveLength(1);
    });
  });

  it('does nothing without a usable selection', () => {
    const editor = makeEditor();
    editor.update(() => {
      expect($insertFootnote()).toBe(false);
    });
    expect(referenceIds(editor)).toEqual([]);
  });
});

describe('$removeFootnoteItem', () => {
  it('removes the matching item and renumbers the rest by document order', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => {
      $insertFootnote();
      $insertFootnote();
    });
    const [firstId, secondId] = referenceIds(editor);

    editor.update(() => $removeFootnoteItem(firstId), { discrete: true });

    expect(listItemIds(editor)).toEqual([secondId]);
  });

  it('removes the list entirely once its last item is gone', () => {
    const editor = makeEditor();
    withCaretInParagraph(editor, () => $insertFootnote());
    const [id] = referenceIds(editor);

    editor.update(() => $removeFootnoteItem(id), { discrete: true });

    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some($isFootnoteListNode)).toBe(false);
    });
  });

  it('is a no-op when there is no footnote list', () => {
    const editor = makeEditor();
    editor.update(() => $removeFootnoteItem('missing'), { discrete: true });
    editor.getEditorState().read(() => {
      expect($getRoot().getChildren().some($isFootnoteListNode)).toBe(false);
    });
  });
});
