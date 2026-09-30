import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Menu, Select, type ComboboxData, type ComboboxItem, type ComboboxItemGroup, type SelectProps } from '@mantine/core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $setSelection,
  $getRoot,
  $getNearestNodeFromDOMNode,
  $createTextNode,
  KEY_MODIFIER_COMMAND,
  COMMAND_PRIORITY_NORMAL,
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
import { $getSelectionStyleValueForProperty, $patchStyleText, $setBlocksType } from '@lexical/selection';
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
import { $findMatchingParent, $insertNodeToNearestRoot } from '@lexical/utils';
import { ImageDialog, type ImageDialogValue } from '../image/ImageDialog';
import { $createImageNode } from '../image/ImageNode';
import { INSERT_PAGE_BREAK_COMMAND } from '../blocks/PageBreakNode';
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { LinkDialog } from './LinkDialog';
import { normalizeLinkUrl } from '../utils/linkUrl';
import type { ResolvedEditorFeatureConfig } from '@inshapardaz/likhari-core';
import { CANVAS_FONT_DEFAULTS, DEFAULT_FONT_OPTIONS, FONT_SIZES_PX, type FontOption } from '../fonts';
import { setStyleProperty } from '../utils/style';
import { useStrings } from '../i18n/useStrings';
import { usePortalTarget } from '../PortalTargetContext';
import type { Locale, Strings } from '../i18n/strings';
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
  IconExternalLink,
  IconFeather,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconIndentDecrease,
  IconIndentIncrease,
  IconItalic,
  IconLetterCase,
  IconLetterCaseLower,
  IconLetterCaseUpper,
  IconLink,
  IconLinkOff,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconPageBreak,
  IconPencil,
  IconPhoto,
  IconPilcrow,
  IconQuote,
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
  /** Inline font-family / font-size at the selection (Lexical reports the first
   * selected text node's): UNSET_STYLE when it has none, so the canvas default
   * applies. */
  fontFamily: string;
  fontSize: string;
  /** Selection is inside a link; `linkUrl` is that link's URL. */
  isLink: boolean;
  linkUrl: string;
  canUndo: boolean;
  canRedo: boolean;
}

/** Sentinel for "no inline style": Lexical returns the default it is given when
 * the selection has none, so this tells "unstyled" (show the canvas default)
 * apart from "styled with a value the dropdown doesn't list" (show nothing). */
const UNSET_STYLE = '__unset__';

const INITIAL_STATE: ToolbarState = {
  blockType: 'paragraph',
  activeFormats: new Set(),
  elementFormat: 'start' as ElementFormatType,
  listType: null,
  fontFamily: UNSET_STYLE,
  fontSize: UNSET_STYLE,
  isLink: false,
  linkUrl: '',
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

const HEADING_ICONS: Record<number, TablerIcon> = {
  1: IconH1,
  2: IconH2,
  3: IconH3,
  4: IconH4,
  5: IconH5,
  6: IconH6,
};

const FORMATTING_ICONS: Record<string, TablerIcon> = {
  paragraph: IconPilcrow,
  h1: HEADING_ICONS[1],
  h2: HEADING_ICONS[2],
  h3: HEADING_ICONS[3],
  h4: HEADING_ICONS[4],
  h5: HEADING_ICONS[5],
  h6: HEADING_ICONS[6],
  number: IconListNumbers,
  bullet: IconList,
  check: IconListCheck,
  quote: IconQuote,
};

/** Shared option renderer for the formatting/alignment dropdowns: an icon
 * ahead of the label, looked up by the option's own value. */
function iconOptionRenderer(icons: Record<string, TablerIcon>, fallback: TablerIcon) {
  return ({ option }: { option: ComboboxItem }) => {
    const Icon = icons[option.value] ?? fallback;
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} stroke={ICON_STROKE} />
        {option.label}
      </span>
    );
  };
}

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
function StubButton({ icon, title, comingSoon }: { icon: TablerIcon; title: string; comingSoon: (label: string) => string }) {
  return <ToolbarButton icon={icon} title={comingSoon(title)} disabled onClick={undefined} />;
}

interface ToolbarSelectProps {
  icon: TablerIcon;
  label: string;
  value: string | null;
  data: ComboboxData;
  width: number;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  renderOption?: SelectProps['renderOption'];
  onChange?: (value: string) => void;
  comingSoon?: (label: string) => string;
  noMatchMessage?: string;
}

/** Mantine Select (combobox) for the toolbar's dropdown controls. The icon
 * labels the control itself, since a dropdown can't show one per option in
 * its closed state. The dropdown portals to <body>, so it is not clipped by
 * the editor's `overflow: hidden` frame. */
function ToolbarSelect({ icon: Icon, label, value, data, width, disabled, placeholder, searchable, renderOption, onChange, comingSoon, noMatchMessage }: ToolbarSelectProps) {
  const portalTarget = usePortalTarget();
  return (
    <Select
      size="xs"
      w={width}
      aria-label={label}
      title={disabled && comingSoon ? comingSoon(label) : label}
      data={data}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      searchable={searchable}
      renderOption={renderOption}
      nothingFoundMessage={searchable ? noMatchMessage : undefined}
      allowDeselect={false}
      leftSection={<Icon size={15} stroke={ICON_STROKE} />}
      comboboxProps={{ withinPortal: true, position: 'bottom-start', middlewares: { flip: true, shift: true }, portalProps: { target: portalTarget } }}
      classNames={{ input: 'likhari-toolbar-select-input', dropdown: 'likhari-toolbar-select-dropdown' }}
      onChange={(v) => v && onChange?.(v)}
    />
  );
}

interface ActionItem {
  key: string;
  icon: TablerIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}

interface MovableGroup {
  key: string;
  items: ActionItem[];
}

const EMPTY_OVERFLOW: ReadonlySet<string> = new Set();

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Renders a movable group's items as normal inline toolbar buttons (used
 * both in the real toolbar and in the hidden width-measuring clone). */
function MovableGroupButtons({ group }: { group: MovableGroup }) {
  return (
    <div className="likhari-toolbar-group" data-group-key={group.key}>
      {group.items.map((item) => (
        <ToolbarButton key={item.key} icon={item.icon} title={item.label} active={item.active} onClick={item.onClick} />
      ))}
    </div>
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

/** The link menu's contents — shared by the toolbar button and the right-click
 * menu: the URL (opens in a new tab), Edit link, Remove link. */
function LinkMenuItems({ url, onEdit, onRemove, strings }: { url: string; onEdit: () => void; onRemove: () => void; strings: Strings }) {
  // Only offer the link as clickable if it's a URL the editor would have accepted.
  const safeUrl = normalizeLinkUrl(url);
  return (
    <>
      <Menu.Label>{strings.link.menuLabel}</Menu.Label>
      {safeUrl ? (
        <Menu.Item
          component="a"
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<IconExternalLink size={ICON_SIZE} stroke={ICON_STROKE} />}
          title={url}
          className="likhari-link-menu-url"
        >
          {url}
        </Menu.Item>
      ) : (
        // Not a URL the editor would accept (e.g. loaded from a document): show it, don't make it clickable.
        <Menu.Item disabled title={url} className="likhari-link-menu-url">
          {url || strings.link.noUrl}
        </Menu.Item>
      )}
      <Menu.Item
        leftSection={<IconPencil size={ICON_SIZE} stroke={ICON_STROKE} />}
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        onClick={onEdit}
      >
        {strings.link.editLink}
      </Menu.Item>
      <Menu.Item
        color="red"
        leftSection={<IconLinkOff size={ICON_SIZE} stroke={ICON_STROKE} />}
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        onClick={onRemove}
      >
        {strings.link.removeLink}
      </Menu.Item>
    </>
  );
}

export interface ToolbarProps {
  config: ResolvedEditorFeatureConfig;
  onSave?: () => void;
  isDirty?: boolean;
  showSave?: boolean;
  /** Font-family dropdown entries; defaults to DEFAULT_FONT_OPTIONS. */
  fontOptions?: FontOption[];
  /** Text direction of the canvas; picks which default font and size are pre-selected. */
  direction?: 'ltr' | 'rtl';
  /** UI locale — picks the translated strings for labels, tooltips and menu items. */
  locale?: Locale;
}

export function Toolbar({ config, onSave, isDirty, showSave, fontOptions = DEFAULT_FONT_OPTIONS, direction = 'ltr', locale = 'en' }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(INITIAL_STATE);
  const strings = useStrings(locale);
  const portalTarget = usePortalTarget();

  // Responsive "priority+" overflow: the toolbar's outer container and a
  // hidden nowrap clone (rendered with every movable group forced inline)
  // are both measured; whenever the clone's natural width exceeds the
  // container's available width, the lowest-priority movable groups are
  // moved into the "..." menu, lowest-priority first, until what remains
  // inline fits (or there's nothing left to move).
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const toolbarMeasureRef = useRef<HTMLDivElement | null>(null);
  const [overflowGroupKeys, setOverflowGroupKeys] = useState<ReadonlySet<string>>(EMPTY_OVERFLOW);

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

      const fontFamily = $getSelectionStyleValueForProperty(selection, 'font-family', UNSET_STYLE);
      const fontSize = $getSelectionStyleValueForProperty(selection, 'font-size', UNSET_STYLE);
      const linkNode = $findMatchingParent(anchorNode, $isLinkNode);
      const isLink = Boolean(linkNode);
      const linkUrl = linkNode && $isLinkNode(linkNode) ? linkNode.getURL() : '';

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
        fontFamily,
        fontSize,
        isLink,
        linkUrl,
      }));
    });
  }, [editor]);

  // Selection changes alone miss edits that change the toolbar's state without
  // moving the caret (e.g. removing the link the caret is in).
  useEffect(() => {
    return editor.registerUpdateListener(() => updateToolbar());
  }, [editor, updateToolbar]);

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
  const snapshotSelectionRef = useRef(snapshotSelection);
  snapshotSelectionRef.current = snapshotSelection;
  const runOverflowAction = (action: () => void) => () => {
    const saved = menuSelectionRef.current;
    if (saved) editor.update(() => $setSelection(saved.clone()), { discrete: true });
    action();
    editor.focus();
  };

  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const openImageDialog = () => {
    // Snapshot first: the dialog's focus trap makes Lexical drop the selection.
    snapshotSelection();
    setImageDialogOpen(true);
  };

  const closeImageDialog = () => {
    setImageDialogOpen(false);
    editor.focus();
  };

  const insertImage = (image: ImageDialogValue) => {
    const saved = menuSelectionRef.current;
    if (saved) editor.update(() => $setSelection(saved.clone()), { discrete: true });
    editor.update(() => {
      $insertNodeToNearestRoot($createImageNode(image));
    });
    closeImageDialog();
  };

  /** Applies a font property per `config.font.scope`: to the selection, to
   * every text node in the document, or (for 'both') to the selection when
   * there is a range and to the whole document when there isn't. */
  const applyFont = (property: 'font-family' | 'font-size', value: string) => {
    editor.update(() => {
      const selection = $getSelection();
      const scope = config.font.scope;
      const wholeDocument =
        scope === 'document' || (scope === 'both' && (!$isRangeSelection(selection) || selection.isCollapsed()));
      if (wholeDocument) {
        for (const node of $getRoot().getAllTextNodes()) {
          node.setStyle(setStyleProperty(node.getStyle(), property, value));
        }
      } else if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { [property]: value });
      }
    });
  };

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkNeedsText, setLinkNeedsText] = useState(false);

  const openLinkDialog = useCallback(() => {
    // Snapshot first: the dialog's focus trap makes Lexical drop the selection.
    let collapsed = false;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      menuSelectionRef.current = selection ? selection.clone() : null;
      collapsed = $isRangeSelection(selection) && selection.isCollapsed();
    });
    setLinkNeedsText(collapsed && !state.isLink);
    setLinkDialogOpen(true);
  }, [editor, state.isLink]);

  const closeLinkDialog = () => {
    setLinkDialogOpen(false);
    editor.focus();
  };

  const restoreSelection = () => {
    const saved = menuSelectionRef.current;
    if (saved) editor.update(() => $setSelection(saved.clone()), { discrete: true });
  };

  const applyLink = ({ url, text }: { url: string; text: string }) => {
    restoreSelection();
    if (linkNeedsText) {
      // Nothing selected: insert a new link with its own text.
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const link = $createLinkNode(url);
        link.append($createTextNode(text));
        selection.insertNodes([link]);
      });
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
    closeLinkDialog();
  };

  const removeLink = () => {
    restoreSelection();
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    closeLinkDialog();
  };

  // Right-clicking a link in the text opens the same menu, at the pointer.
  const [linkContext, setLinkContext] = useState<{ x: number; y: number; url: string } | null>(null);

  useEffect(() => {
    if (!config.links) return;
    const onContextMenu = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      let url: string | null = null;
      // Select the whole link first, so Edit / Remove act on it wherever the caret was.
      editor.update(
        () => {
          const node = $getNearestNodeFromDOMNode(anchor);
          const link = node ? $findMatchingParent(node, $isLinkNode) : null;
          if (!link || !$isLinkNode(link)) return;
          url = link.getURL();
          link.select(0, link.getChildrenSize());
        },
        { discrete: true },
      );
      if (url === null) return;
      event.preventDefault();
      snapshotSelectionRef.current();
      setLinkContext({ x: event.clientX, y: event.clientY, url });
    };
    return editor.registerRootListener((root, previous) => {
      previous?.removeEventListener('contextmenu', onContextMenu);
      root?.addEventListener('contextmenu', onContextMenu);
    });
  }, [editor, config.links]);

  // Ctrl/Cmd+K opens the link dialog.
  useEffect(() => {
    if (!config.links) return;
    return editor.registerCommand(
      KEY_MODIFIER_COMMAND,
      (event: KeyboardEvent) => {
        if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return false;
        event.preventDefault();
        openLinkDialog();
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, config.links, openLinkDialog]);

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
  const showStubInsertGroup = config.images.linked || config.images.embedded || config.blocks.pageBreak || config.poetry.enabled;
  const showLanguageGroup = config.language.autocorrect || config.language.textCleanup || config.language.spellCheck;

  // The "script & cleanup" and "indent/outdent" groups (UI spec §3.3) render
  // as normal inline toolbar groups whenever there's room, and only move
  // into the "..." overflow menu when the measured toolbar content doesn't
  // fit the available width (see the ResizeObserver effect below) — this
  // replaces the old always-on overflow menu, which was driven purely by
  // these config flags regardless of actual space.
  const scriptCleanupItems: ActionItem[] = [];
  if (fmt.strikethrough) {
    scriptCleanupItems.push({
      key: 'strikethrough',
      icon: IconStrikethrough,
      label: strings.toolbar.strikethrough,
      active: state.activeFormats.has('strikethrough'),
      onClick: () => formatText('strikethrough'),
    });
  }
  if (fmt.superscript) {
    scriptCleanupItems.push({
      key: 'superscript',
      icon: IconSuperscript,
      label: strings.toolbar.superscript,
      active: state.activeFormats.has('superscript'),
      onClick: () => formatText('superscript'),
    });
  }
  if (fmt.subscript) {
    scriptCleanupItems.push({
      key: 'subscript',
      icon: IconSubscript,
      label: strings.toolbar.subscript,
      active: state.activeFormats.has('subscript'),
      onClick: () => formatText('subscript'),
    });
  }
  if (fmt.caseTransforms) {
    scriptCleanupItems.push(
      { key: 'upper', icon: IconLetterCaseUpper, label: strings.toolbar.uppercase, onClick: () => applyCaseTransform('upper') },
      { key: 'lower', icon: IconLetterCaseLower, label: strings.toolbar.lowercase, onClick: () => applyCaseTransform('lower') },
      { key: 'capitalize', icon: IconLetterCase, label: strings.toolbar.capitalize, onClick: () => applyCaseTransform('capitalize') },
    );
  }
  if (fmt.clearFormatting) {
    scriptCleanupItems.push({ key: 'clear', icon: IconClearFormatting, label: strings.toolbar.clearFormatting, onClick: clearFormatting });
  }

  const indentItems: ActionItem[] = config.indent
    ? [
        {
          key: 'outdent',
          icon: IconIndentDecrease,
          label: strings.toolbar.outdent,
          onClick: () => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
        },
        {
          key: 'indent',
          icon: IconIndentIncrease,
          label: strings.toolbar.indent,
          onClick: () => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
        },
      ]
    : [];

  // Low to high priority: the first group here is the first one pushed into
  // overflow once content stops fitting (UI spec §3.3).
  const movableGroups: MovableGroup[] = [
    { key: 'scriptCleanup', items: scriptCleanupItems },
    { key: 'indentOutdent', items: indentItems },
  ].filter((g) => g.items.length > 0);
  const movableGroupKeys = useMemo(() => movableGroups.map((g) => g.key).join(','), [movableGroups]);

  // Re-measure whenever the container is resized, or whenever the set of
  // movable groups (and so the hidden clone's content) changes.
  useLayoutEffect(() => {
    const container = toolbarContainerRef.current;
    const measure = toolbarMeasureRef.current;
    if (!container || !measure) return;

    // Rough width of the "..." button itself (icon button + its gap) —
    // only charged against the budget once something has actually moved
    // into it, since it isn't rendered at all otherwise.
    const OVERFLOW_BUTTON_WIDTH = 38;

    const recompute = () => {
      const available = container.clientWidth;
      const total = measure.scrollWidth;
      if (total <= available) {
        setOverflowGroupKeys((prev) => (prev.size === 0 ? prev : EMPTY_OVERFLOW));
        return;
      }
      const widths = new Map<string, number>();
      measure.querySelectorAll<HTMLElement>('[data-group-key]').forEach((el) => {
        widths.set(el.dataset.groupKey as string, el.getBoundingClientRect().width);
      });
      let remaining = total;
      const next = new Set<string>();
      for (const key of movableGroupKeys.split(',').filter(Boolean)) {
        if (remaining <= available) break;
        const w = widths.get(key);
        if (w === undefined) continue;
        remaining -= w;
        next.add(key);
      }
      if (next.size > 0) remaining += OVERFLOW_BUTTON_WIDTH;
      setOverflowGroupKeys((prev) => (setsEqual(prev, next) ? prev : next));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  });

  // Grouped for the dropdown when options declare groups (Latin / Urdu).
  const fontData: (ComboboxItem | ComboboxItemGroup<ComboboxItem>)[] = (() => {
    const data: (ComboboxItem | ComboboxItemGroup<ComboboxItem>)[] = [];
    const groups = new Map<string, ComboboxItemGroup<ComboboxItem>>();
    for (const f of fontOptions) {
      const item: ComboboxItem = { value: f.family, label: f.name };
      if (!f.group) {
        data.push(item);
        continue;
      }
      let group = groups.get(f.group);
      if (!group) {
        group = { group: f.group, items: [] };
        groups.set(f.group, group);
        data.push(group);
      }
      group.items.push(item);
    }
    return data;
  })();

  // Unstyled text shows the canvas default (pre-selected).
  const canvasDefaults = CANVAS_FONT_DEFAULTS[direction];
  const shownFontFamily = state.fontFamily === UNSET_STYLE ? canvasDefaults.family : state.fontFamily;
  const shownFontSize = state.fontSize === UNSET_STYLE ? canvasDefaults.size : state.fontSize;

  const formattingOptions = [
    { value: 'paragraph', label: strings.toolbar.formattingOptions.paragraph },
    ...headingLevels.map((level) => ({ value: `h${level}`, label: strings.toolbar.formattingOptions.heading(level) })),
    ...(config.lists.numbered ? [{ value: 'number', label: strings.toolbar.formattingOptions.numberedList }] : []),
    ...(config.lists.bullet ? [{ value: 'bullet', label: strings.toolbar.formattingOptions.bulletList }] : []),
    ...(config.lists.check ? [{ value: 'check', label: strings.toolbar.formattingOptions.taskList }] : []),
    ...(config.blocks.quote ? [{ value: 'quote', label: strings.toolbar.formattingOptions.quote }] : []),
  ];
  const alignOptions = [
    ...(config.alignment.start ? [{ value: 'start', label: strings.toolbar.alignOptions.start }] : []),
    ...(config.alignment.center ? [{ value: 'center', label: strings.toolbar.alignOptions.center }] : []),
    ...(config.alignment.start ? [{ value: 'end', label: strings.toolbar.alignOptions.end }] : []),
    ...(config.alignment.justify ? [{ value: 'justify', label: strings.toolbar.alignOptions.justify }] : []),
    ...(config.alignment.left ? [{ value: 'left', label: strings.toolbar.alignOptions.left }] : []),
    ...(config.alignment.right ? [{ value: 'right', label: strings.toolbar.alignOptions.right }] : []),
  ];
  const formattingValue: FormattingValue = state.listType ?? state.blockType;
  const AlignIcon = ALIGN_ICONS[state.elementFormat] ?? IconAlignLeft;

  // The toolbar's "always inline" groups (UI spec §3.3's Desktop tier) —
  // built as an array so the exact same elements can be rendered both in
  // the visible toolbar and in the hidden width-measuring clone below,
  // without duplicating the JSX. The link right-click context menu is kept
  // out of this list: it's a zero-size, fixed-position anchor, not part of
  // the toolbar's own layout width.
  const fixedGroups: ReactNode[] = [
    showSave && (
      <div className="likhari-toolbar-group" key="save">
        <ToolbarButton icon={IconDeviceFloppy} title={strings.toolbar.save} dirty={Boolean(isDirty)} onClick={onSave} />
      </div>
    ),
    config.history && (
      <div className="likhari-toolbar-group" key="history">
        <ToolbarButton
          icon={IconArrowBackUp}
          title={strings.toolbar.undo}
          disabled={!state.canUndo}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        />
        <ToolbarButton
          icon={IconArrowForwardUp}
          title={strings.toolbar.redo}
          disabled={!state.canRedo}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        />
      </div>
    ),
    showFormattingGroup && (
      <div className="likhari-toolbar-group" key="formatting">
        <ToolbarSelect
          icon={IconPilcrow}
          label={strings.toolbar.formattingLabel}
          width={148}
          value={formattingValue}
          data={formattingOptions}
          comingSoon={strings.toolbar.comingSoon}
          renderOption={iconOptionRenderer(FORMATTING_ICONS, IconPilcrow)}
          onChange={withRefocus((v) => applyFormatting(v as FormattingValue))}
        />
      </div>
    ),
    showInlineGroup && (
      <div className="likhari-toolbar-group" key="inline">
        {fmt.bold && (
          <ToolbarButton icon={IconBold} title={strings.toolbar.bold} active={state.activeFormats.has('bold')} onClick={() => formatText('bold')} />
        )}
        {fmt.italic && (
          <ToolbarButton
            icon={IconItalic}
            title={strings.toolbar.italic}
            active={state.activeFormats.has('italic')}
            onClick={() => formatText('italic')}
          />
        )}
        {fmt.underline && (
          <ToolbarButton
            icon={IconUnderline}
            title={strings.toolbar.underline}
            active={state.activeFormats.has('underline')}
            onClick={() => formatText('underline')}
          />
        )}
      </div>
    ),
    (config.font.family || config.font.size) && (
      <div className="likhari-toolbar-group" key="font">
        {config.font.family && (
          <ToolbarSelect
            icon={IconTypography}
            label={strings.toolbar.fontFamily}
            width={150}
            value={fontOptions.some((f) => f.family === shownFontFamily) ? shownFontFamily : null}
            placeholder={strings.toolbar.fontFamilyPlaceholder}
            data={fontData}
            searchable
            noMatchMessage={strings.toolbar.noMatch}
            renderOption={({ option }) => <span style={{ fontFamily: option.value }}>{option.label}</span>}
            onChange={withRefocus((v: string) => applyFont('font-family', v))}
          />
        )}
        {config.font.size && (
          <ToolbarSelect
            icon={IconTextSize}
            label={strings.toolbar.fontSize}
            width={84}
            value={FONT_SIZES_PX.some((px) => `${px}px` === shownFontSize) ? shownFontSize : null}
            placeholder={strings.toolbar.fontSizePlaceholder}
            data={FONT_SIZES_PX.map((px) => ({ value: `${px}px`, label: String(px) }))}
            onChange={withRefocus((v: string) => applyFont('font-size', v))}
          />
        )}
      </div>
    ),
    showAlignGroup && (
      <div className="likhari-toolbar-group" key="align">
        <ToolbarSelect
          icon={AlignIcon}
          label={strings.toolbar.alignment}
          width={138}
          value={state.elementFormat || 'start'}
          data={alignOptions}
          renderOption={iconOptionRenderer(ALIGN_ICONS as Record<string, TablerIcon>, IconAlignLeft)}
          onChange={withRefocus((v) => formatElement(v as ElementFormatType))}
        />
      </div>
    ),
    config.links && (
      <div className="likhari-toolbar-group" key="link">
        {state.isLink ? (
          // Caret is in a link: the button opens a menu to see, edit or remove it.
          <Menu position="bottom-start" withinPortal portalProps={{ target: portalTarget }} shadow="sm" width={240} onOpen={snapshotSelection}>
            <Menu.Target>
              <button
                type="button"
                className="likhari-toolbar-button"
                data-active="true"
                aria-pressed="true"
                aria-haspopup="menu"
                aria-label={strings.toolbar.linkOptions}
                title={strings.toolbar.linkOptions}
                onMouseDown={(e) => e.preventDefault()}
              >
                <IconLink size={ICON_SIZE} stroke={ICON_STROKE} />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              <LinkMenuItems
                url={state.linkUrl}
                onEdit={() => {
                  restoreSelection();
                  openLinkDialog();
                }}
                onRemove={removeLink}
                strings={strings}
              />
            </Menu.Dropdown>
          </Menu>
        ) : (
          <ToolbarButton icon={IconLink} title={strings.toolbar.insertLink} onClick={openLinkDialog} />
        )}
      </div>
    ),
    showStubInsertGroup && (
      <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet" key="stubInsert">
        {(config.images.linked || config.images.embedded) && (
          <ToolbarButton icon={IconPhoto} title={strings.toolbar.insertImage} onClick={openImageDialog} />
        )}
        {config.blocks.pageBreak && (
          <ToolbarButton
            icon={IconPageBreak}
            title={strings.toolbar.insertPageBreak}
            onClick={() => editor.dispatchCommand(INSERT_PAGE_BREAK_COMMAND, undefined)}
          />
        )}
        {config.poetry.enabled && <StubButton icon={IconFeather} title={strings.toolbar.poetryBlocks} comingSoon={strings.toolbar.comingSoon} />}
      </div>
    ),
    showLanguageGroup && (
      <div className="likhari-toolbar-group likhari-toolbar-group--collapse-tablet" key="language">
        {config.language.autocorrect && <StubButton icon={IconWand} title={strings.toolbar.autocorrect} comingSoon={strings.toolbar.comingSoon} />}
        {config.language.textCleanup && <StubButton icon={IconSparkles} title={strings.toolbar.textCleanup} comingSoon={strings.toolbar.comingSoon} />}
        {config.language.spellCheck && <StubButton icon={IconAbc} title={strings.toolbar.spellChecker} comingSoon={strings.toolbar.comingSoon} />}
      </div>
    ),
  ];

  return (
    <div className="likhari-toolbar" role="toolbar" aria-label={strings.toolbar.ariaLabel} ref={toolbarContainerRef}>
      {fixedGroups}

      {/* Movable groups (script & cleanup, indent/outdent) — rendered as
          normal inline buttons here whenever they aren't currently measured
          as overflowing (see the ResizeObserver effect above). */}
      {movableGroups
        .filter((group) => !overflowGroupKeys.has(group.key))
        .map((group) => (
          <MovableGroupButtons key={group.key} group={group} />
        ))}

      {/* Overflow: whichever movable groups don't currently fit the
          available width — genuinely empty (and hidden) otherwise, per the
          responsive "priority+" pattern (UI spec §3.3). A Mantine Menu
          portals its dropdown out of the toolbar, so it can't be clipped or
          add a scrollbar. */}
      {overflowGroupKeys.size > 0 && (
        <Menu position="bottom-end" withinPortal portalProps={{ target: portalTarget }} shadow="sm" width={210} closeOnItemClick onOpen={snapshotSelection}>
          <Menu.Target>
            <button
              type="button"
              className="likhari-toolbar-button"
              aria-label={strings.toolbar.moreFormatting}
              title={strings.toolbar.moreFormatting}
              onMouseDown={(e) => e.preventDefault()}
            >
              <IconDots size={ICON_SIZE} stroke={ICON_STROKE} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {movableGroups
              .filter((group) => overflowGroupKeys.has(group.key))
              .flatMap((group) =>
                group.items.map((item) => (
                  <OverflowItem key={item.key} icon={item.icon} label={item.label} active={item.active} onClick={runOverflowAction(item.onClick)} />
                )),
              )}
          </Menu.Dropdown>
        </Menu>
      )}

      {config.links && (
        <Menu
          opened={linkContext !== null}
          onChange={(opened) => {
            if (!opened) setLinkContext(null);
          }}
          position="bottom-start"
          withinPortal
          portalProps={{ target: portalTarget }}
          shadow="sm"
          width={240}
        >
          <Menu.Target>
            {/* Invisible 1px anchor positioned at the right-click */}
            <span
              aria-hidden="true"
              style={{ position: 'fixed', left: linkContext?.x ?? -9999, top: linkContext?.y ?? -9999, width: 1, height: 1, pointerEvents: 'none' }}
            />
          </Menu.Target>
          <Menu.Dropdown>
            <LinkMenuItems
              url={linkContext?.url ?? ''}
              onEdit={() => {
                restoreSelection();
                openLinkDialog();
              }}
              onRemove={removeLink}
              strings={strings}
            />
          </Menu.Dropdown>
        </Menu>
      )}

      {/* Hidden clone, rendering every group (fixed + movable) inline with
          no wrapping — its natural (unclipped) width is what the effect
          above compares against the container's available width to decide
          what, if anything, needs to move into the "..." menu. */}
      <div
        aria-hidden="true"
        ref={toolbarMeasureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          top: 0,
          left: 0,
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 8,
        }}
      >
        {fixedGroups}
        {movableGroups.map((group) => (
          <MovableGroupButtons key={group.key} group={group} />
        ))}
      </div>
      {(config.images.linked || config.images.embedded) && (
        <ImageDialog mode="insert" opened={imageDialogOpen} onSubmit={insertImage} onClose={closeImageDialog} />
      )}
      {config.links && (
        <LinkDialog
          opened={linkDialogOpen}
          initialUrl={state.linkUrl}
          showTextField={linkNeedsText}
          onSubmit={applyLink}
          onRemove={state.isLink ? removeLink : undefined}
          onClose={closeLinkDialog}
        />
      )}
    </div>
  );
}
