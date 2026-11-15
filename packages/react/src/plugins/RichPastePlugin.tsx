import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, PASTE_COMMAND } from 'lexical';
import { $pasteTextAsRichContent } from '../utils/richPaste';

/**
 * Imports pasted text that is written in one of the interchange formats
 * (Markdown, HTML source, Lexical JSON) through the matching parser, so the
 * content arrives as headings, lists, links and so on rather than as literal
 * `# ` and `**` syntax.
 *
 * Runs ahead of LinkPastePlugin and Lexical's own paste. Leaves alone:
 *
 * - copies from within a Lexical editor (they carry their own node data);
 * - copies that carry real `text/html` (web pages, word processors), which
 *   Lexical's paste already imports;
 * - plain prose, bare URLs and anything that fails to parse.
 */
export function RichPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboard = 'clipboardData' in event ? event.clipboardData : null;
        if (!clipboard || clipboard.getData('application/x-lexical-editor')) return false;
        const text = clipboard.getData('text/plain');
        if (!text) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        if (!$pasteTextAsRichContent(editor, text, selection, clipboard.getData('text/html'))) return false;
        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
}
