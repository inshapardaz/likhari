import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { COMMAND_PRIORITY_EDITOR } from 'lexical';
import { INSERT_LAYOUT_COMMAND, LayoutContainerNode, LayoutItemNode } from '../blocks/LayoutNode';
import { $insertLayout, $normalizeLayoutContainer, $normalizeLayoutItem } from '../blocks/layoutActions';

/**
 * Registers INSERT_LAYOUT_COMMAND (mirrors PageBreakPlugin) and two node
 * transforms that keep the container/item pairing structurally valid —
 * needed because paste, undo and JSON import can all produce a tree the UI
 * itself never would. The actual logic lives in blocks/layoutActions.ts so
 * it's testable without mounting a React tree.
 */
export function LayoutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([LayoutContainerNode, LayoutItemNode])) {
      throw new Error('LayoutPlugin: LayoutContainerNode/LayoutItemNode not registered on the editor');
    }

    return mergeRegister(
      editor.registerCommand(INSERT_LAYOUT_COMMAND, ({ columnCount }) => $insertLayout(columnCount), COMMAND_PRIORITY_EDITOR),
      editor.registerNodeTransform(LayoutItemNode, $normalizeLayoutItem),
      editor.registerNodeTransform(LayoutContainerNode, $normalizeLayoutContainer),
    );
  }, [editor]);

  return null;
}
