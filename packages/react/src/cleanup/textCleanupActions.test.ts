import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { $cleanUpText } from './textCleanupActions';

function makeEditor(): LexicalEditor {
  return createEditor({
    namespace: 'cleanup-test',
    onError: (e) => {
      throw e;
    },
  });
}

function setParagraph(editor: LexicalEditor, parts: { text: string; bold?: boolean }[]): void {
  editor.update(
    () => {
      const root = $getRoot().clear();
      const paragraph = $createParagraphNode();
      for (const part of parts) {
        const node = $createTextNode(part.text);
        if (part.bold) node.toggleFormat('bold');
        paragraph.append(node);
      }
      root.append(paragraph);
    },
    { discrete: true },
  );
}

describe('$cleanUpText', () => {
  it('collapses repeated spaces and tabs to one space', () => {
    const editor = makeEditor();
    setParagraph(editor, [{ text: 'a  b\t\tc   d' }]);
    let changed = 0;
    editor.update(() => (changed = $cleanUpText()), { discrete: true });
    expect(changed).toBe(1);
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('a b c d');
  });

  it('normalises Arabic-script text to NFC, so visually identical words compare equal', () => {
    const editor = makeEditor();
    // Alef with madda: U+0627 + combining U+0653 (decomposed) vs. the precomposed U+0622.
    setParagraph(editor, [{ text: 'آ' }]);
    editor.update(() => $cleanUpText(), { discrete: true });
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('آ');
  });

  it('keeps formatting on each text node it cleans', () => {
    const editor = makeEditor();
    setParagraph(editor, [{ text: 'plain  ' }, { text: 'bold  text', bold: true }]);
    editor.update(() => $cleanUpText(), { discrete: true });
    editor.getEditorState().read(() => {
      const [plain, bold] = $getRoot().getAllTextNodes();
      expect(plain.getTextContent()).toBe('plain ');
      expect(bold.getTextContent()).toBe('bold text');
      expect(bold.hasFormat('bold')).toBe(true);
    });
  });

  it('removes text nodes left empty', () => {
    const editor = makeEditor();
    setParagraph(editor, [{ text: 'keep' }, { text: '' }]);
    editor.update(() => $cleanUpText(), { discrete: true });
    editor.getEditorState().read(() => expect($getRoot().getAllTextNodes()).toHaveLength(1));
  });

  it('changes nothing in text that is already clean', () => {
    const editor = makeEditor();
    setParagraph(editor, [{ text: 'already clean' }]);
    let changed = -1;
    editor.update(() => (changed = $cleanUpText()), { discrete: true });
    expect(changed).toBe(0);
  });
});
