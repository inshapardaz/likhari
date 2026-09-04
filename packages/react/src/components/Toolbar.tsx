import { useCallback, useEffect, useRef, useState } from 'react';
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
type ListType = 'bullet' | 'number' | 'check';
/** The unified value the single "Formatting" dropdown shows/sets. */
type FormattingValue = BlockType | ListType;

interface ToolbarState {
  blockType: BlockType;
  activeFormats: Set<TextFormatType>;
  elementFormat: ElementFormatType;
  listType: ListType | null;
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
  title,
  active,
  disabled,
  onClick,
}: {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="likhari-toolbar-button"
      data-active={active ? 'true' : 'false'}
      disabled={disabled}
      aria-pressed={active}
      aria-label={title ?? label}
      title={title ?? label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** A disabled placeholder for a feature whose config flag is on but that
 * isn't implemented yet (link/image/poetry/font/language-tooling — see
 * docs/lexical-editor-spec.md §13's phasing). Renders so the toolbar's
 * layout is final now and only needs its onClick wired up later. */
function StubButton({ label, title }: { label: string; title: string }) {
  return <ToolbarButton label={label} title={`${title} (coming soon)`} disabled onClick={undefined} />;
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
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

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

  // Close the overflow panel on outside click or Escape.
  useEffect(() => {
    if (!overflowOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowOpen]);

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

  const insertList = (type: ListType) => {
    const command =
      type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : type === 'number' ? INSERT_ORDERED_LIST_COMMAND : INSERT_CHECK_LIST_COMMAND;
    editor.dispatchCommand(command, undefined);
  };

  /** Handler for the single "Formatting" dropdown — unifies block type and
   * list type into one control (Heading 1-6 / Numbered / Bullet / Task /
   * Quote / Paragraph), matching the requested compact toolbar layout. */
  const applyFormatting = (value: FormattingValue) => {
    if (value === 'bullet' || value === 'number' || value === 'check') {
      insertList(value);
      return;
    }
    if (state.listType) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
    setBlockType(value);
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

  const headingLevels = config.blocks.headingLevels ?? [];
  const fmt = config.formatting;

  const showFormattingGroup =
    headingLevels.length > 0 || config.lists.bullet || config.lists.numbered || config.lists.check || config.blocks.quote;
  const showInlineGroup = fmt.bold || fmt.italic || fmt.underline;
  const showAlignGroup =
    config.alignment.start || config.alignment.center || config.alignment.justify || config.alignment.left || config.alignment.right;
  const showInsertPoetryGroup = config.links || config.images.linked || config.images.embedded || config.poetry.enabled;
  const showLanguageGroup = config.language.autocorrect || config.language.textCleanup || config.language.spellCheck;
  const showOverflowMenu =
    fmt.strikethrough || fmt.superscript || fmt.subscript || fmt.caseTransforms || fmt.clearFormatting || config.indent;

  const formattingValue: FormattingValue = state.listType ?? state.blockType;

  return (
    <div className="likhari-toolbar" role="toolbar" aria-label="Formatting">
      {/* Save */}
      {showSave && (
        <button type="button" className="likhari-save-button" data-dirty={isDirty ? 'true' : 'false'} onClick={onSave}>
          Save
        </button>
      )}

      {/* Undo / redo */}
      {config.history && (
        <div className="likhari-toolbar-group">
          <ToolbarButton label="↶" title="Undo" disabled={!state.canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
          <ToolbarButton label="↷" title="Redo" disabled={!state.canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />
        </div>
      )}

      {/* Formatting: block type + list type + quote, unified into one dropdown */}
      {showFormattingGroup && (
        <div className="likhari-toolbar-group">
          <select
            className="likhari-toolbar-select"
            aria-label="Formatting"
            value={formattingValue}
            onChange={(e) => applyFormatting(e.target.value as FormattingValue)}
          >
            <option value="paragraph">Paragraph</option>
            {headingLevels.map((level) => (
              <option key={level} value={`h${level}`}>
                Heading {level}
              </option>
            ))}
            {config.lists.numbered && <option value="number">Numbered list</option>}
            {config.lists.bullet && <option value="bullet">Bullet list</option>}
            {config.lists.check && <option value="check">Task list</option>}
            {config.blocks.quote && <option value="quote">Quote</option>}
          </select>
        </div>
      )}

      {/* Bold / italic / underline */}
      {showInlineGroup && (
        <div className="likhari-toolbar-group">
          {fmt.bold && <ToolbarButton label="B" title="Bold" active={state.activeFormats.has('bold')} onClick={() => formatText('bold')} />}
          {fmt.italic && (
            <ToolbarButton label="I" title="Italic" active={state.activeFormats.has('italic')} onClick={() => formatText('italic')} />
          )}
          {fmt.underline && (
            <ToolbarButton
              label="U"
              title="Underline"
              active={state.activeFormats.has('underline')}
              onClick={() => formatText('underline')}
            />
          )}
        </div>
      )}

      {/* Font family, font size — stubs, not implemented yet. Grouped with
          alignment in the requested layout, but split into its own group
          here so it (not alignment, which actually works) is what collapses
          on small viewports — see the collapse-tablet comment below. */}
      {(config.font.family || config.font.size) && (
        <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet">
          {config.font.family && (
            <select className="likhari-toolbar-select" aria-label="Font family" disabled title="Font family (coming soon)">
              <option>Font</option>
            </select>
          )}
          {config.font.size && (
            <select className="likhari-toolbar-select" aria-label="Font size" disabled title="Font size (coming soon)">
              <option>Size</option>
            </select>
          )}
        </div>
      )}

      {showAlignGroup && (
        <div className="likhari-toolbar-group">
          <select
            className="likhari-toolbar-select"
            aria-label="Alignment"
            value={state.elementFormat || 'start'}
            onChange={(e) => formatElement(e.target.value as ElementFormatType)}
          >
            {config.alignment.start && <option value="start">Align start</option>}
            {config.alignment.center && <option value="center">Align center</option>}
            {config.alignment.start && <option value="end">Align end</option>}
            {config.alignment.justify && <option value="justify">Justify</option>}
            {config.alignment.left && <option value="left">Align left</option>}
            {config.alignment.right && <option value="right">Align right</option>}
          </select>
        </div>
      )}

      {/* Link, image, poetry blocks — stubs, gated by config, not implemented yet */}
      {showInsertPoetryGroup && (
        <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet">
          {config.links && <StubButton label="🔗" title="Insert link" />}
          {(config.images.linked || config.images.embedded) && <StubButton label="🖼" title="Insert image" />}
          {config.poetry.enabled && <StubButton label="Poetry ▾" title="Poetry blocks" />}
        </div>
      )}

      {/* Auto-correct, text cleanup, spell-checker — stubs, gated by config, not implemented yet */}
      {showLanguageGroup && (
        <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet">
          {config.language.autocorrect && <StubButton label="AC" title="Auto-correct" />}
          {config.language.textCleanup && <StubButton label="TC" title="Text cleanup" />}
          {config.language.spellCheck && <StubButton label="ABC" title="Spell-checker" />}
        </div>
      )}

      {/* Overflow: less-frequent formatting (strikethrough, superscript/
          subscript, case transforms, clear formatting, indent/outdent) —
          keeps the primary row compact for small/mobile viewports. */}
      {showOverflowMenu && (
        <div className="likhari-toolbar-overflow" ref={overflowRef}>
          <ToolbarButton label="⋯" title="More formatting" active={overflowOpen} onClick={() => setOverflowOpen((o) => !o)} />
          {overflowOpen && (
            <div className="likhari-toolbar-overflow-panel" role="menu">
              {fmt.strikethrough && (
                <ToolbarButton
                  label="S"
                  title="Strikethrough"
                  active={state.activeFormats.has('strikethrough')}
                  onClick={() => formatText('strikethrough')}
                />
              )}
              {fmt.superscript && (
                <ToolbarButton
                  label="x²"
                  title="Superscript"
                  active={state.activeFormats.has('superscript')}
                  onClick={() => formatText('superscript')}
                />
              )}
              {fmt.subscript && (
                <ToolbarButton
                  label="x₂"
                  title="Subscript"
                  active={state.activeFormats.has('subscript')}
                  onClick={() => formatText('subscript')}
                />
              )}
              {fmt.caseTransforms && (
                <>
                  <ToolbarButton label="AA" title="UPPERCASE" onClick={() => applyCaseTransform('upper')} />
                  <ToolbarButton label="aa" title="lowercase" onClick={() => applyCaseTransform('lower')} />
                  <ToolbarButton label="Aa" title="Capitalize" onClick={() => applyCaseTransform('capitalize')} />
                </>
              )}
              {fmt.clearFormatting && <ToolbarButton label="Tx" title="Clear formatting" onClick={clearFormatting} />}
              {config.indent && (
                <>
                  <ToolbarButton label="⇦" title="Outdent" onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)} />
                  <ToolbarButton label="⇨" title="Indent" onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)} />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
