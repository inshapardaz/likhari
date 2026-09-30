import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { $createPageBreakNode, INSERT_PAGE_BREAK_COMMAND } from '../blocks/PageBreakNode';

/** Registers INSERT_PAGE_BREAK_COMMAND — mirrors @lexical/react's own HorizontalRulePlugin. */
export function PageBreakPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_PAGE_BREAK_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        $insertNodeToNearestRoot($createPageBreakNode());
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}
