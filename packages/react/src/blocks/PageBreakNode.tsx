import { useCallback, useEffect, type ReactElement } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { addClassNamesToElement, mergeRegister, removeClassNamesFromElement } from '@lexical/utils';
import { useUiStrings } from '../i18n/useStrings';
import {
  $applyNodeReplacement,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalCommand,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';

export const INSERT_PAGE_BREAK_COMMAND: LexicalCommand<void> = createCommand('INSERT_PAGE_BREAK_COMMAND');

export type SerializedPageBreakNode = SerializedLexicalNode;

const SELECTED_CLASS_NAME = 'likhari-page-break-selected';

function PageBreakComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const strings = useUiStrings();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      const selection = $getSelection();
      if (isSelected && $isNodeSelection(selection)) {
        event.preventDefault();
        editor.update(() => {
          selection.getNodes().forEach((node) => {
            if ($isPageBreakNode(node)) node.remove();
          });
        });
      }
      return false;
    },
    [editor, isSelected],
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const element = editor.getElementByKey(nodeKey);
          // The marker is made of child spans (the label and two lines), so a
          // click almost never lands on the outer element itself.
          if (!element || !element.contains(event.target as Node)) return false;
          if (!event.shiftKey) clearSelection();
          setSelected(!isSelected);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
    );
  }, [clearSelection, editor, isSelected, nodeKey, onDelete, setSelected]);

  useEffect(() => {
    const element = editor.getElementByKey(nodeKey);
    if (!element) return;
    if (isSelected) addClassNamesToElement(element, SELECTED_CLASS_NAME);
    else removeClassNamesFromElement(element, SELECTED_CLASS_NAME);
  }, [editor, isSelected, nodeKey]);

  return (
    <>
      <span className="likhari-page-break-line" aria-hidden="true" />
      <span className="likhari-page-break-label">{strings.editor.pageBreakLabel}</span>
      <span className="likhari-page-break-line" aria-hidden="true" />
    </>
  );
}

/**
 * A manual page break — a print/paginated-export concept with no native
 * Lexical node (lexical-editor-spec.md §4.3/§4.6). Renders as a visible
 * dashed marker while editing, and as `page-break-after: always` both live
 * (a print stylesheet, editor.css) and in exported HTML (`exportDOM`).
 *
 * Mirrors @lexical/react's HorizontalRuleNode pattern: `createDOM` returns
 * the actual visible element (the click target `PageBreakComponent` wires
 * selection/delete against), rather than `decorate()` rendering visuals.
 */
export class PageBreakNode extends DecoratorNode<ReactElement> {
  static getType(): string {
    return 'page-break';
  }

  static clone(node: PageBreakNode): PageBreakNode {
    return new PageBreakNode(node.__key);
  }

  static importJSON(): PageBreakNode {
    return $createPageBreakNode();
  }

  exportJSON(): SerializedPageBreakNode {
    return { type: 'page-break', version: 1 };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-likhari-page-break')) return null;
        return { conversion: () => ({ node: $createPageBreakNode() }), priority: 2 };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-likhari-page-break', '');
    element.style.pageBreakAfter = 'always';
    return { element };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.pageBreak ?? 'likhari-page-break');
    return element;
  }

  getTextContent(): string {
    return '\n';
  }

  isInline(): false {
    return false;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate() {
    return <PageBreakComponent nodeKey={this.__key} />;
  }
}

export function $createPageBreakNode(): PageBreakNode {
  return $applyNodeReplacement(new PageBreakNode());
}

export function $isPageBreakNode(node: LexicalNode | null | undefined): node is PageBreakNode {
  return node instanceof PageBreakNode;
}
