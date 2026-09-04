import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  type ElementFormatType,
  type TextFormatType,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode } from 'lexical';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  ListNode,
} from '@lexical/list';
import { $findMatchingParent } from '@lexical/utils';
import type { ResolvedEditorFeatureConfig } from '@likhari/core';

type BlockType = 'paragraph' | 'quote' | `h${1 | 2 | 3 | 4 | 5 | 6}`;

interface ToolbarState {
  blockType: BlockType;
  activeFormats: Set<TextFormatType>;
  elementFormat: ElementFormatType;
  listType: 'bullet' | 'number' | 'check' | null;
  canUndo: boolean;
  canRedo: boolean;
}

const INITIAL_STATE: ToolbarState = {
  blockType: 'paragraph',
  activeFormats: new Set(),
  elementFormat: 'start' as ElementFormatType,
  listType: null,
  canUndo: false,
  canRedo: false,
};

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="likhari-toolbar-button"
      data-active={active ? 'true' : 'false'}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export interface ToolbarProps {
  config: ResolvedEditorFeatureConfig;
  onSave?: () => void;
  isDirty?: boolean;
  showSave?: boolean;
}

export function Toolbar({ config, onSave, isDirty, showSave }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(INITIAL_STATE);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' ? anchorNode : (anchorNode.getTopLevelElement() ?? anchorNode);

      const listParent = $findMatchingParent(anchorNode, $isListNode);
      const listType = listParent && $isListNode(listParent) ? (listParent as ListNode).getListType() : null;

      let blockType: BlockType = 'paragraph';
      if ($isHeadingNode(element)) {
        blockType = element.getTag() as BlockType;
      } else if ($isQuoteNode(element)) {
        blockType = 'quote';
      }

      const activeFormats = new Set<TextFormatType>();
      (['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript'] as TextFormatType[]).forEach(
        (format) => {
          if (selection.hasFormat(format)) activeFormats.add(format);
        },
      );

      // Computed eagerly, inside the active read() callback — React calls the
      // setState updater lazily during its own reconciliation, by which point
      // Lexical's read/update context has already closed, so any $-prefixed
      // node method (getFormatType() included) must not be deferred into it.
      const elementFormat = ($isElementNode(element) ? element.getFormatType() : 'start') || 'start';

      setState((s) => ({
        ...s,
        blockType,
        activeFormats,
        elementFormat,
        listType,
      }));
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setState((s) => ({ ...s, canUndo: payload }));
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setState((s) => ({ ...s, canRedo: payload }));
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  const setBlockType = (type: BlockType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (type === 'paragraph') {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (type === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(type));
      }
    });
  };

  const formatText = (format: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  const formatElement = (format: ElementFormatType) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);

  const applyCaseTransform = (transform: 'upper' | 'lower' | 'capitalize') => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const nodes = selection.getNodes();
      for (const node of nodes) {
        if (node.getType() !== 'text') continue;
        const textNode = node as import('lexical').TextNode;
        const text = textNode.getTextContent();
        // Arabic-script (Urdu/Punjabi) has no case concept — skip RTL runs (spec §4.1).
        if (/[؀-ۿ]/.test(text)) continue;
        const next =
          transform === 'upper'
            ? text.toUpperCase()
            : transform === 'lower'
              ? text.toLowerCase()
              : text.replace(/\b\w/g, (c) => c.toUpperCase());
        textNode.setTextContent(next);
      }
    });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      selection.getNodes().forEach((node) => {
        if (node.getType() !== 'text') return;
        const textNode = node as import('lexical').TextNode;
        textNode.setFormat(0);
        textNode.setStyle('');
      });
    });
  };

  const toggleList = (type: 'bullet' | 'number' | 'check') => {
    if (state.listType === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      return;
    }
    const command =
      type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : type === 'number' ? INSERT_ORDERED_LIST_COMMAND : INSERT_CHECK_LIST_COMMAND;
    editor.dispatchCommand(command, undefined);
  };

  const headingLevels = config.blocks.headingLevels ?? [];
  const fmt = config.formatting;
  const showScriptGroup = fmt.superscript || fmt.subscript || fmt.caseTransforms || fmt.clearFormatting;
  const showListGroup = config.lists.bullet || config.lists.numbered || config.lists.check || config.blocks.quote;
  const showAlignGroup =
    config.alignment.start || config.alignment.center || config.alignment.justify || config.alignment.left || config.alignment.right;

  return (
    <div className="likhari-toolbar" role="toolbar" aria-label="Formatting">
      {/* Group 1: block type. The reference mockup (mockups/editor-ui-mockup.html)
          settles the requirements doc's ambiguous "quote as list items" line: its
          block-type <select> holds only Paragraph/Heading levels, and Quote is a
          separate toggle button in the lists group (group 4) — followed here. */}
      {headingLevels.length > 0 && (
        <div className="likhari-toolbar-group">
          <select
            className="likhari-toolbar-select"
            aria-label="Block type"
            value={state.blockType === 'quote' ? 'paragraph' : state.blockType}
            onChange={(e) => setBlockType(e.target.value as BlockType)}
          >
            <option value="paragraph">Paragraph</option>
            {headingLevels.map((level) => (
              <option key={level} value={`h${level}`}>
                Heading {level}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Group 2: inline formatting */}
      {(fmt.bold || fmt.italic || fmt.underline || fmt.strikethrough) && (
        <div className="likhari-toolbar-group">
          {fmt.bold && <ToolbarButton label="B" active={state.activeFormats.has('bold')} onClick={() => formatText('bold')} />}
          {fmt.italic && <ToolbarButton label="I" active={state.activeFormats.has('italic')} onClick={() => formatText('italic')} />}
          {fmt.underline && (
            <ToolbarButton label="U" active={state.activeFormats.has('underline')} onClick={() => formatText('underline')} />
          )}
          {fmt.strikethrough && (
            <ToolbarButton label="S" active={state.activeFormats.has('strikethrough')} onClick={() => formatText('strikethrough')} />
          )}
        </div>
      )}

      {/* Group 3: script & cleanup (case transforms simplified to inline buttons for
          Phase 1; the spec's overflow submenu is a UI-polish item for a later pass) */}
      {showScriptGroup && (
        <div className="likhari-toolbar-group">
          {fmt.superscript && (
            <ToolbarButton label="x²" active={state.activeFormats.has('superscript')} onClick={() => formatText('superscript')} />
          )}
          {fmt.subscript && (
            <ToolbarButton label="x₂" active={state.activeFormats.has('subscript')} onClick={() => formatText('subscript')} />
          )}
          {fmt.caseTransforms && (
            <>
              <ToolbarButton label="AA" onClick={() => applyCaseTransform('upper')} />
              <ToolbarButton label="aa" onClick={() => applyCaseTransform('lower')} />
              <ToolbarButton label="Aa" onClick={() => applyCaseTransform('capitalize')} />
            </>
          )}
          {fmt.clearFormatting && <ToolbarButton label="Tx" onClick={clearFormatting} />}
        </div>
      )}

      {/* Group 4: lists */}
      {showListGroup && (
        <div className="likhari-toolbar-group">
          {config.lists.bullet && (
            <ToolbarButton label="•" active={state.listType === 'bullet'} onClick={() => toggleList('bullet')} />
          )}
          {config.lists.numbered && (
            <ToolbarButton label="1." active={state.listType === 'number'} onClick={() => toggleList('number')} />
          )}
          {config.lists.check && (
            <ToolbarButton label="☑" active={state.listType === 'check'} onClick={() => toggleList('check')} />
          )}
          {config.blocks.quote && (
            <ToolbarButton
              label="❝"
              active={state.blockType === 'quote'}
              onClick={() => setBlockType(state.blockType === 'quote' ? 'paragraph' : 'quote')}
            />
          )}
        </div>
      )}

      {/* Group 5: alignment & indent */}
      {showAlignGroup && (
        <div className="likhari-toolbar-group">
          {config.alignment.start && (
            <ToolbarButton label="⇤" active={state.elementFormat === 'start'} onClick={() => formatElement('start')} />
          )}
          {config.alignment.center && (
            <ToolbarButton label="↔" active={state.elementFormat === 'center'} onClick={() => formatElement('center')} />
          )}
          {config.alignment.start && (
            <ToolbarButton label="⇥" active={state.elementFormat === 'end'} onClick={() => formatElement('end')} />
          )}
          {config.alignment.justify && (
            <ToolbarButton label="≡" active={state.elementFormat === 'justify'} onClick={() => formatElement('justify')} />
          )}
          {config.alignment.left && (
            <ToolbarButton label="L" active={state.elementFormat === 'left'} onClick={() => formatElement('left')} />
          )}
          {config.alignment.right && (
            <ToolbarButton label="R" active={state.elementFormat === 'right'} onClick={() => formatElement('right')} />
          )}
          {config.indent && (
            <>
              <ToolbarButton label="⇦" onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)} />
              <ToolbarButton label="⇨" onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)} />
            </>
          )}
        </div>
      )}

      <div className="likhari-toolbar-spacer" />

      {/* Group 9: history */}
      {config.history && (
        <div className="likhari-toolbar-group">
          <ToolbarButton label="↶" disabled={!state.canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
          <ToolbarButton label="↷" disabled={!state.canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />
        </div>
      )}

      {/* Group 10: save */}
      {showSave && (
        <button type="button" className="likhari-save-button" data-dirty={isDirty ? 'true' : 'false'} onClick={onSave}>
          Save
        </button>
      )}
    </div>
  );
}
