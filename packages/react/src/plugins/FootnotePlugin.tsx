import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { COMMAND_PRIORITY_EDITOR } from 'lexical';
import { $getFootnoteIdByKey, FootnoteReferenceNode, INSERT_FOOTNOTE_COMMAND } from '../blocks/FootnoteNode';
import { $isFootnoteItemNode, $isFootnoteListNode, FootnoteItemNode, FootnoteListNode } from '../blocks/FootnoteListNode';
import { $insertFootnote, $removeFootnoteItem } from '../blocks/footnoteActions';

/**
 * Registers INSERT_FOOTNOTE_COMMAND, a mutation listener that removes a
 * FootnoteItemNode when its matching FootnoteReferenceNode is deleted from
 * the text (so the list never accumulates orphaned notes), and two node
 * transforms that keep the list/item nesting valid against malformed trees
 * from paste, undo or JSON import — mirrors LayoutPlugin's shape.
 */
export function FootnotePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([FootnoteReferenceNode, FootnoteListNode, FootnoteItemNode])) {
      throw new Error('FootnotePlugin: footnote node types not registered on the editor');
    }

    return mergeRegister(
      editor.registerCommand(INSERT_FOOTNOTE_COMMAND, () => $insertFootnote(), COMMAND_PRIORITY_EDITOR),
      editor.registerMutationListener(
        FootnoteReferenceNode,
        (mutations, { prevEditorState }) => {
          const destroyedIds: string[] = [];
          for (const [key, mutation] of mutations) {
            if (mutation !== 'destroyed') continue;
            const id = $getFootnoteIdByKey(prevEditorState, key);
            if (id) destroyedIds.push(id);
          }
          if (destroyedIds.length === 0) return;
          editor.update(() => {
            for (const id of destroyedIds) $removeFootnoteItem(id);
          });
        },
        { skipInitialization: true },
      ),
      editor.registerNodeTransform(FootnoteItemNode, (node) => {
        const parent = node.getParent();
        if ($isFootnoteListNode(parent)) return;
        for (const child of node.getChildren()) node.insertBefore(child);
        node.remove();
      }),
      editor.registerNodeTransform(FootnoteListNode, (node) => {
        for (const child of node.getChildren()) {
          if (!$isFootnoteItemNode(child)) child.remove();
        }
      }),
    );
  }, [editor]);

  return null;
}
