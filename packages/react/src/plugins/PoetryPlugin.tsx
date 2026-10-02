import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_EDITOR, createCommand, type LexicalCommand } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { LayoutContainerNode, LayoutItemNode } from '../blocks/LayoutNode';
import { PoetryBlockNode, type PoetryAlign, type PoetryLayout } from '../blocks/PoetryNode';
import { $insertPoetryCouplet } from '../blocks/poetryActions';

export const INSERT_POETRY_COUPLET_COMMAND: LexicalCommand<{ layout: PoetryLayout; align: PoetryAlign }> = createCommand(
  'INSERT_POETRY_COUPLET_COMMAND',
);

/**
 * Registers INSERT_POETRY_COUPLET_COMMAND (mirrors LayoutPlugin/FootnotePlugin's
 * shape) and a node transform that removes a couplet left with no misra
 * content — e.g. after undo/paste leaves it structurally empty — rather
 * than letting an unselectable husk linger in the document.
 */
export function PoetryPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([PoetryBlockNode, LayoutContainerNode, LayoutItemNode])) {
      throw new Error('PoetryPlugin: PoetryBlockNode (and the columns nodes it composes) not registered on the editor');
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_POETRY_COUPLET_COMMAND,
        ({ layout, align }) => $insertPoetryCouplet(layout, align),
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerNodeTransform(PoetryBlockNode, (node) => {
        if (node.getChildrenSize() === 0) node.remove();
      }),
    );
  }, [editor]);

  return null;
}
