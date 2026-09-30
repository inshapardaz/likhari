import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createLinkNode, $toggleLink } from '@lexical/link';
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  type LexicalNode,
} from 'lexical';
import { splitPastedText } from '../utils/linkUrl';

/**
 * Turns pasted URLs into links instead of inserting them as bare text:
 *
 * - a lone URL pasted over selected text links that text (the URL isn't inserted);
 * - a lone URL pasted at a caret becomes a link whose text is the URL;
 * - a single line of plain text containing URLs gets a link node per URL.
 *
 * Everything else — multi-line text, or anything copied with HTML (Lexical's
 * own paste already turns `<a>` into links) — falls through to the default paste.
 */
export function LinkPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboard = 'clipboardData' in event ? event.clipboardData : null;
        const text = clipboard?.getData('text/plain');
        if (!clipboard || !text) return false;

        const segments = splitPastedText(text.trim());
        const hasLink = segments.some((s) => s.type === 'link');
        const isLoneUrl = segments.length === 1 && segments[0].type === 'link';
        const isPlainSingleLine = !clipboard.getData('text/html') && !/[\r\n]/.test(text.trim());
        if (!hasLink || !(isLoneUrl || isPlainSingleLine)) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        event.preventDefault();

        if (isLoneUrl && !selection.isCollapsed()) {
          $toggleLink((segments[0] as { url: string }).url);
          return true;
        }

        const nodes: LexicalNode[] = segments.map((segment) => {
          if (segment.type === 'text') return $createTextNode(segment.text);
          const link = $createLinkNode(segment.url);
          link.append($createTextNode(segment.text));
          return link;
        });
        selection.insertNodes(nodes);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}
