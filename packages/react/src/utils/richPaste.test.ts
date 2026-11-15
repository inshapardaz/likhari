import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, createEditor, type LexicalEditor } from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isListNode } from '@lexical/list';
import { $isLinkNode } from '@lexical/link';
import { EDITOR_NODES } from '../nodes';
import { $isFootnoteReferenceNode } from '../blocks/FootnoteNode';
import { $isFootnoteItemNode, $isFootnoteListNode } from '../blocks/FootnoteListNode';
import { $insertFootnote } from '../blocks/footnoteActions';
import { $pasteTextAsRichContent, formatForPastedText } from './richPaste';

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: 'test',
    nodes: EDITOR_NODES,
    onError: (e) => {
      throw e;
    },
  });
}

/** A document of one paragraph "hello", the caret at its end; returns what the paste reported. */
function pasteAtEnd(editor: LexicalEditor, text: string, html?: string): boolean {
  let handled = false;
  editor.update(
    () => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
      $getRoot().getFirstChild()!.selectEnd();
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('no range selection');
      handled = $pasteTextAsRichContent(editor, text, selection, html);
    },
    { discrete: true },
  );
  return handled;
}

const blockTypes = (editor: LexicalEditor) => editor.getEditorState().read(() => $getRoot().getChildren().map((n) => n.getType()));

describe('formatForPastedText', () => {
  it('defers to the default paste when the clipboard carries real HTML', () => {
    expect(formatForPastedText('# Title', '<meta charset="utf-8"><h1># Title</h1>')).toBeNull();
    expect(formatForPastedText('- item', '<ul><li>- item</li></ul>')).toBeNull();
  });

  it('still inspects the text when the HTML is only a code editor styling wrapper', () => {
    const codeEditorHtml = '<div style="color: #ccc;background-color: #1f1f1f;font-family: Consolas;"><div><span style="color: #569cd6;"># Title</span></div></div>';
    expect(formatForPastedText('# Title', codeEditorHtml)).toBe('markdown');
    expect(formatForPastedText('just words', codeEditorHtml)).toBeNull();
  });
});

describe('$pasteTextAsRichContent', () => {
  it('leaves plain text to the caller', () => {
    const editor = makeEditor();
    expect(pasteAtEnd(editor, 'some plain words\nand another line')).toBe(false);
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('hello');
  });

  it('pastes Markdown as blocks, the first run joining the current paragraph', () => {
    const editor = makeEditor();
    expect(pasteAtEnd(editor, ' **world**\n\n## Heading\n\n- one\n- two\n\nA [link](https://example.com).')).toBe(true);
    expect(blockTypes(editor)).toEqual(['paragraph', 'heading', 'list', 'paragraph']);
    editor.getEditorState().read(() => {
      const [first, heading, list, last] = $getRoot().getChildren();
      expect(first.getTextContent()).toBe('helloworld'); // Markdown has no leading space in a paragraph
      expect($isHeadingNode(heading) && heading.getTag()).toBe('h2');
      expect($isListNode(list) && list.getChildrenSize()).toBe(2);
      expect(last.getTextContent()).toBe('A link.');
      expect((last as ReturnType<typeof $createParagraphNode>).getChildren().some($isLinkNode)).toBe(true);
    });
  });

  it('pastes HTML source through the HTML importer', () => {
    const editor = makeEditor();
    expect(pasteAtEnd(editor, '<p>Body <em>text</em></p><h1>Title</h1>')).toBe(true);
    expect(blockTypes(editor)).toEqual(['paragraph', 'heading']);
    expect(editor.getEditorState().read(() => $getRoot().getFirstChild()!.getTextContent())).toBe('helloBody text');
  });

  it('merges the first pasted block into the current paragraph, as a native paste does', () => {
    const editor = makeEditor();
    expect(pasteAtEnd(editor, '<h1>Title</h1><p>Body</p>')).toBe(true);
    expect(blockTypes(editor)).toEqual(['paragraph', 'paragraph']);
    expect(editor.getEditorState().read(() => $getRoot().getFirstChild()!.getTextContent())).toBe('helloTitle');
  });

  it('keeps the first block when pasting into an empty paragraph', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        $getRoot().append($createParagraphNode());
        $getRoot().getFirstChild()!.selectEnd();
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('no range selection');
        expect($pasteTextAsRichContent(editor, '# Title\n\nBody', selection)).toBe(true);
      },
      { discrete: true },
    );
    expect(blockTypes(editor)).toEqual(['heading', 'paragraph']);
  });

  it('pastes Lexical JSON through the JSON importer', () => {
    const editor = makeEditor();
    const json = JSON.stringify({
      root: {
        type: 'root', version: 1, direction: null, format: '', indent: 0,
        children: [
          { type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', children: [{ type: 'text', text: ' there', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }] },
          { type: 'heading', tag: 'h3', version: 1, direction: null, format: '', indent: 0, children: [{ type: 'text', text: 'Pasted', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }] },
        ],
      },
    });
    expect(pasteAtEnd(editor, json)).toBe(true);
    expect(blockTypes(editor)).toEqual(['paragraph', 'heading']);
  });

  it('falls back when the text looks like a format but does not parse', () => {
    const editor = makeEditor();
    // Lexical JSON with a node type the editor does not know cannot be imported.
    const json = JSON.stringify({ root: { type: 'root', version: 1, children: [{ type: 'no-such-node', version: 1 }] } });
    expect(pasteAtEnd(editor, json)).toBe(false);
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('hello');
  });

  it('adds pasted footnotes to the document footnote list under fresh ids', () => {
    const editor = makeEditor();
    editor.update(
      () => {
        $getRoot().append($createParagraphNode().append($createTextNode('existing')));
        $getRoot().getFirstChild()!.selectEnd();
        $insertFootnote();
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $getRoot().getFirstChild()!.selectEnd();
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error('no range selection');
        expect($pasteTextAsRichContent(editor, ' more[^1] and[^2]\n\n[^1]: First note\n[^2]: Second note', selection)).toBe(true);
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((n) => n.getType())).toEqual(['paragraph', 'footnote-list']);
      const refs = (children[0] as ReturnType<typeof $createParagraphNode>).getChildren().filter($isFootnoteReferenceNode).map((r) => r.getFootnoteId());
      const items = (children[1] as ReturnType<typeof $createParagraphNode>).getChildren().filter($isFootnoteItemNode).map((i) => i.getFootnoteId());
      expect(refs).toHaveLength(3);
      expect(items).toEqual(refs);
      expect(new Set(items).size).toBe(3);
      expect(items).not.toContain('1');
      expect($isFootnoteListNode(children[1])).toBe(true);
      expect(children[1].getTextContent()).toContain('Second note');
    });
  });
});
