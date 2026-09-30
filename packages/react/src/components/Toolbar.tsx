import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Menu, Select } from '@mantine/core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $setSelection,
  type BaseSelection,
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
import type { ResolvedEditorFeatureConfig } from '@inshapardaz/likhari-core';
import {
  IconAbc,
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconClearFormatting,
  IconDeviceFloppy,
  IconDots,
  IconFeather,
  IconIndentDecrease,
  IconIndentIncrease,
  IconItalic,
  IconLetterCase,
  IconLetterCaseLower,
  IconLetterCaseUpper,
  IconLink,
  IconPhoto,
  IconPilcrow,
  IconSparkles,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconTextSize,
  IconTypography,
  IconUnderline,
  IconWand,
  type IconProps,
} from '@tabler/icons-react';

type BlockType = 'paragraph' | 'quote' | `h${1 | 2 | 3 | 4 | 5 | 6}`;
type ListType = 'bullet' | 'number' | 'check';
/** The unified value the single "Formatting" dropdown shows/sets. */
type FormattingValue = BlockType | ListType;
type TablerIcon = ComponentType<IconProps>;

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

const ICON_SIZE = 17;
const ICON_STROKE = 1.75;

const ALIGN_ICONS: Partial<Record<ElementFormatType, TablerIcon>> = {
  start: IconAlignLeft,
  left: IconAlignLeft,
  center: IconAlignCenter,
  end: IconAlignRight,
  right: IconAlignRight,
  justify: IconAlignJustified,
};

function ToolbarButton({
  icon: Icon,
  title,
  active,
  dirty,
  disabled,
  onClick,
}: {
  icon: TablerIcon;
  title: string;
  active?: boolean;
  /** Save button only: filled while there are unsaved changes (UI spec §7). */
  dirty?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="likhari-toolbar-button"
      data-active={active ? 'true' : 'false'}
      data-dirty={dirty === undefined ? undefined : dirty ? 'true' : 'false'}
      disabled={disabled}
      aria-pressed={active}
      aria-label={title}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon size={ICON_SIZE} stroke={ICON_STROKE} />
    </button>
  );
}

/** A disabled placeholder for a feature whose config flag is on but that
 * isn't implemented yet (link/image/poetry/font/language-tooling — see
 * docs/lexical-editor-spec.md §13's phasing). Renders so the toolbar's
 * layout is final now and only needs its onClick wired up later. */
function StubButton({ icon, title }: { icon: TablerIcon; title: string }) {
  return <ToolbarButton icon={icon} title={`${title} (coming soon)`} disabled onClick={undefined} />;
}

interface ToolbarSelectProps {
  icon: TablerIcon;
  label: string;
  value: string | null;
  data: { value: string; label: string }[];
  width: number;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

/** Mantine Select (combobox) for the toolbar's dropdown controls. The icon
 * labels the control itself, since a dropdown can't show one per option in
 * its closed state. The dropdown portals to <body>, so it is not clipped by
 * the editor's `overflow: hidden` frame. */
function ToolbarSelect({ icon: Icon, label, value, data, width, disabled, placeholder, onChange }: ToolbarSelectProps) {
  return (
    <Select
      size="xs"
      w={width}
      aria-label={label}
      title={disabled ? `${label} (coming soon)` : label}
      data={data}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      allowDeselect={false}
      leftSection={<Icon size={15} stroke={ICON_STROKE} />}
      comboboxProps={{ withinPortal: true, position: 'bottom-start', middlewares: { flip: true, shift: true } }}
      classNames={{ input: 'likhari-toolbar-select-input', dropdown: 'likhari-toolbar-select-dropdown' }}
      onChange={(v) => v && onChange?.(v)}
    />
  );
}

function OverflowItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: TablerIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Menu.Item
      leftSection={<Icon size={ICON_SIZE} stroke={ICON_STROKE} />}
      data-active={active ? 'true' : 'false'}
      className="likhari-overflow-item"
      // Keep the editor's selection: a mousedown here would blur the canvas.
      onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </Menu.Item>
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

  /** Runs a toolbar-select action, then returns focus to the canvas — the
   * combobox otherwise keeps it, so typing after picking would go nowhere. */
  // Opening the overflow Menu moves focus into its dropdown, which makes
  // Lexical drop the canvas selection — so snapshot it on open and restore it
  // before an item's action runs.
  const menuSelectionRef = useRef<BaseSelection | null>(null);
  const snapshotSelection = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      menuSelectionRef.current = selection ? selection.clone() : null;
    });
  };
  const runOverflowAction = (action: () => void) => () => {
    const saved = menuSelectionRef.current;
    if (saved) editor.update(() => $setSelection(saved.clone()), { discrete: true });
    action();
    editor.focus();
  };

  const withRefocus = <T,>(fn: (value: T) => void) => (value: T) => {
    fn(value);
    editor.focus();
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

  const formattingOptions = [
    { value: 'paragraph', label: 'Paragraph' },
    ...headingLevels.map((level) => ({ value: `h${level}`, label: `Heading ${level}` })),
    ...(config.lists.numbered ? [{ value: 'number', label: 'Numbered list' }] : []),
    ...(config.lists.bullet ? [{ value: 'bullet', label: 'Bullet list' }] : []),
    ...(config.lists.check ? [{ value: 'check', label: 'Task list' }] : []),
    ...(config.blocks.quote ? [{ value: 'quote', label: 'Quote' }] : []),
  ];
  const alignOptions = [
    ...(config.alignment.start ? [{ value: 'start', label: 'Align start' }] : []),
    ...(config.alignment.center ? [{ value: 'center', label: 'Align center' }] : []),
    ...(config.alignment.start ? [{ value: 'end', label: 'Align end' }] : []),
    ...(config.alignment.justify ? [{ value: 'justify', label: 'Justify' }] : []),
    ...(config.alignment.left ? [{ value: 'left', label: 'Align left' }] : []),
    ...(config.alignment.right ? [{ value: 'right', label: 'Align right' }] : []),
  ];
  const formattingValue: FormattingValue = state.listType ?? state.blockType;
  const AlignIcon = ALIGN_ICONS[state.elementFormat] ?? IconAlignLeft;

  return (
    <div className="likhari-toolbar" role="toolbar" aria-label="Formatting">
      {/* Save — icon only; filled while dirty, outline once saved */}
      {showSave && (
        <div className="likhari-toolbar-group">
          <ToolbarButton icon={IconDeviceFloppy} title="Save" dirty={Boolean(isDirty)} onClick={onSave} />
        </div>
      )}

      {/* Undo / redo */}
      {config.history && (
        <div className="likhari-toolbar-group">
          <ToolbarButton
            icon={IconArrowBackUp}
            title="Undo"
            disabled={!state.canUndo}
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          />
          <ToolbarButton
            icon={IconArrowForwardUp}
            title="Redo"
            disabled={!state.canRedo}
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          />
        </div>
      )}

      {/* Formatting: block type + list type + quote, unified into one dropdown */}
      {showFormattingGroup && (
        <div className="likhari-toolbar-group">
          <ToolbarSelect
            icon={IconPilcrow}
            label="Formatting"
            width={148}
            value={formattingValue}
            data={formattingOptions}
            onChange={withRefocus((v) => applyFormatting(v as FormattingValue))}
          />
        </div>
      )}

      {/* Bold / italic / underline */}
      {showInlineGroup && (
        <div className="likhari-toolbar-group">
          {fmt.bold && (
            <ToolbarButton icon={IconBold} title="Bold" active={state.activeFormats.has('bold')} onClick={() => formatText('bold')} />
          )}
          {fmt.italic && (
            <ToolbarButton
              icon={IconItalic}
              title="Italic"
              active={state.activeFormats.has('italic')}
              onClick={() => formatText('italic')}
            />
          )}
          {fmt.underline && (
            <ToolbarButton
              icon={IconUnderline}
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
            <ToolbarSelect icon={IconTypography} label="Font family" width={110} value={null} placeholder="Font" data={[]} disabled />
          )}
          {config.font.size && (
            <ToolbarSelect icon={IconTextSize} label="Font size" width={90} value={null} placeholder="Size" data={[]} disabled />
          )}
        </div>
      )}

      {showAlignGroup && (
        <div className="likhari-toolbar-group">
          <ToolbarSelect
            icon={AlignIcon}
            label="Alignment"
            width={138}
            value={state.elementFormat || 'start'}
            data={alignOptions}
            onChange={withRefocus((v) => formatElement(v as ElementFormatType))}
          />
        </div>
      )}

      {/* Link, image, poetry blocks — stubs, gated by config, not implemented yet */}
      {showInsertPoetryGroup && (
        <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet">
          {config.links && <StubButton icon={IconLink} title="Insert link" />}
          {(config.images.linked || config.images.embedded) && <StubButton icon={IconPhoto} title="Insert image" />}
          {config.poetry.enabled && <StubButton icon={IconFeather} title="Poetry blocks" />}
        </div>
      )}

      {/* Auto-correct, text cleanup, spell-checker — stubs, gated by config, not implemented yet */}
      {showLanguageGroup && (
        <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet">
          {config.language.autocorrect && <StubButton icon={IconWand} title="Auto-correct" />}
          {config.language.textCleanup && <StubButton icon={IconSparkles} title="Text cleanup" />}
          {config.language.spellCheck && <StubButton icon={IconAbc} title="Spell-checker" />}
        </div>
      )}

      {/* Overflow: less-frequent formatting (strikethrough, superscript/
          subscript, case transforms, clear formatting, indent/outdent) —
          keeps the primary row compact. A Mantine Menu portals its dropdown
          out of the toolbar, so it can't be clipped or add a scrollbar. */}
      {showOverflowMenu && (
        <Menu position="bottom-end" withinPortal shadow="sm" width={210} closeOnItemClick onOpen={snapshotSelection}>
          <Menu.Target>
            <button
              type="button"
              className="likhari-toolbar-button"
              aria-label="More formatting"
              title="More formatting"
              onMouseDown={(e) => e.preventDefault()}
            >
              <IconDots size={ICON_SIZE} stroke={ICON_STROKE} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {fmt.strikethrough && (
              <OverflowItem icon={IconStrikethrough} label="Strikethrough" active={state.activeFormats.has('strikethrough')} onClick={runOverflowAction(() => formatText('strikethrough'))} />
            )}
            {fmt.superscript && (
              <OverflowItem icon={IconSuperscript} label="Superscript" active={state.activeFormats.has('superscript')} onClick={runOverflowAction(() => formatText('superscript'))} />
            )}
            {fmt.subscript && (
              <OverflowItem icon={IconSubscript} label="Subscript" active={state.activeFormats.has('subscript')} onClick={runOverflowAction(() => formatText('subscript'))} />
            )}
            {fmt.caseTransforms && (
              <>
                <OverflowItem icon={IconLetterCaseUpper} label="UPPERCASE" onClick={runOverflowAction(() => applyCaseTransform('upper'))} />
                <OverflowItem icon={IconLetterCaseLower} label="lowercase" onClick={runOverflowAction(() => applyCaseTransform('lower'))} />
                <OverflowItem icon={IconLetterCase} label="Capitalize" onClick={runOverflowAction(() => applyCaseTransform('capitalize'))} />
              </>
            )}
            {fmt.clearFormatting && <OverflowItem icon={IconClearFormatting} label="Clear formatting" onClick={runOverflowAction(clearFormatting)} />}
            {config.indent && (
              <>
                <OverflowItem icon={IconIndentDecrease} label="Outdent" onClick={runOverflowAction(() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined))} />
                <OverflowItem icon={IconIndentIncrease} label="Indent" onClick={runOverflowAction(() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined))} />
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
}
