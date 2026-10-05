import { Fragment, forwardRef, useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef, type ComponentType, type ReactNode } from 'react';
import { Menu, Select, Toolbar as MantineToolbar, type ComboboxData, type ComboboxItem, type ComboboxItemGroup, type SelectProps } from '@mantine/core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $setSelection,
  $getRoot,
  $selectAll,
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
import { CORRECT_DOCUMENT_COMMAND } from '../autocorrect/AutoCorrectPlugin';
import { $canJoinLines, $joinSelectedLines } from '../join/joinLinesActions';
import { $replaceMatch, type FindMatch } from '../find/findReplaceActions';
import { getSpeller, type SpellLanguage } from '../spellcheck/spellDictionaries';
import { lookupSynonyms, type ThesaurusStore } from '../thesaurus/thesaurusStores';
import { addUserWord, ignoreWord, type UserWordStore } from '../spellcheck/userWords';
import { $wordAtDomPoint, textPointAt, type WordAtPoint } from '../spellcheck/spellingMenu';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { ImageDialog, type ImageDialogValue } from '../image/ImageDialog';
import { $createImageNode } from '../image/ImageNode';
import { INSERT_PAGE_BREAK_COMMAND } from '../blocks/PageBreakNode';
import { INSERT_LAYOUT_COMMAND } from '../blocks/LayoutNode';
import { INSERT_FOOTNOTE_COMMAND } from '../blocks/FootnoteNode';
import {
  $isPoetryBlockNode,
  POETRY_GUTTERS,
  POETRY_SPACINGS,
  POETRY_STAGGERS,
  type PoetryGutter,
  type PoetryLayout,
  type PoetrySpacing,
  type PoetryStagger,
} from '../blocks/PoetryNode';
import {
  $adjustPoetryGutter,
  $getCoupletCenteredFromSelection,
  $setCoupletCentered,
  $adjustPoetryStagger,
  $adjustPoetrySpacing,
  $deletePoetryBlock,
  $deletePoetryCouplet,
  $getPoetryBlockFromSelection,
  $insertCoupletRelativeToSelection,
  $setPoetryLayout,
} from '../blocks/poetryActions';
import { INSERT_POETRY_COUPLET_COMMAND } from '../plugins/PoetryPlugin';
import { TableDialog, type TableDialogValue } from './TableDialog';
import { LayoutDialog, type LayoutDialogValue } from './LayoutDialog';
import { $getTableCellNodeFromLexicalNode, $isTableSelection, INSERT_TABLE_COMMAND } from '@lexical/table';
import {
  $canMergeSelectedCells,
  $canUnmergeSelectedCell,
  $deleteTable,
  $deleteTableColumns,
  $deleteTableRows,
  $getTableSelectionSize,
  $insertTableColumns,
  $insertTableRows,
  $mergeTableCells,
  $unmergeTableCell,
} from '../table/tableActions';
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { LinkDialog } from './LinkDialog';
import { DraftsDialog, type DraftsToolbarOptions } from './DraftsDialog';
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
  IconArrowsJoin,
  IconBold,
  IconClearFormatting,
  IconDeviceFloppy,
  IconDots,
  IconHistory,
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
  IconSeparatorHorizontal,
  IconSparkles,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconArrowMergeBoth,
  IconArrowsSplit2,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconColumns,
  IconClipboard,
  IconCopy,
  IconCut,
  IconSearch,
  IconSelectAll,
  IconColumns1,
  IconColumns2,
  IconNumber1Small,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconArrowsShuffle,
  IconTable,
  IconTableMinus,
  IconTrash,
  IconTableOptions,
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
  canJoinLines: boolean;
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
  /** The caret (or a multi-cell selection) is inside a table. */
  inTable: boolean;
  /** Rows / columns the selection spans, for the table menu's plural labels. */
  tableRows: number;
  tableColumns: number;
  /** A multi-cell table selection that can be collapsed into one cell. */
  canMergeCells: boolean;
  /** A caret in a single table cell that already spans more than one row/column. */
  canUnmergeCell: boolean;
  /** The caret is inside a poetry couplet; layout mirrors that couplet's own. */
  inPoetry: boolean;
  poetryLayout: PoetryLayout;
  poetryScale: PoetryScale;
  poetryCentered: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

/** Sentinel for "no inline style": Lexical returns the default it is given when
 * the selection has none, so this tells "unstyled" (show the canvas default)
 * apart from "styled with a value the dropdown doesn't list" (show nothing). */
const UNSET_STYLE = '__unset__';

const INITIAL_STATE: ToolbarState = {
  canJoinLines: false,
  blockType: 'paragraph',
  activeFormats: new Set(),
  elementFormat: 'start' as ElementFormatType,
  listType: null,
  fontFamily: UNSET_STYLE,
  fontSize: UNSET_STYLE,
  isLink: false,
  linkUrl: '',
  inTable: false,
  tableRows: 1,
  tableColumns: 1,
  canMergeCells: false,
  canUnmergeCell: false,
  inPoetry: false,
  poetryLayout: 'single',
  poetryScale: { spacing: 'normal', gutter: 'normal', stagger: 'normal' },
  poetryCentered: false,
  canUndo: false,
  canRedo: false,
};

const ICON_SIZE = 17;
const ICON_STROKE = 1.75;

const ALIGN_ICONS_LTR: Partial<Record<ElementFormatType, TablerIcon>> = {
  start: IconAlignLeft,
  left: IconAlignLeft,
  center: IconAlignCenter,
  end: IconAlignRight,
  right: IconAlignRight,
  justify: IconAlignJustified,
};

// UI spec §5: "start"/"end" are direction-relative — in RTL, start points
// right, so the icon has to swap glyphs. "left"/"right" are the poetry
// preset's literal per-couplet overrides and never mirror.
const ALIGN_ICONS_RTL: Partial<Record<ElementFormatType, TablerIcon>> = {
  ...ALIGN_ICONS_LTR,
  start: IconAlignRight,
  end: IconAlignLeft,
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

interface ToolbarButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'title'> {
  icon: TablerIcon;
  title: string;
  active?: boolean;
  /** Save button only: filled while there are unsaved changes (UI spec §7). */
  dirty?: boolean;
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { icon: Icon, title, active, dirty, onMouseDown, ...rest },
  ref,
) {
  return (
    <MantineToolbar.Toggle
      ref={ref}
      aria-label={title}
      title={title}
      active={active}
      data-dirty={dirty === undefined ? undefined : dirty ? 'true' : 'false'}
      // Keep the editor's selection: a mousedown here would blur the canvas.
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.(e);
      }}
      {...rest}
    >
      <Icon size={ICON_SIZE} stroke={ICON_STROKE} />
    </MantineToolbar.Toggle>
  );
});

function withDividers(sections: (ReactNode | false)[]): ReactNode[] {
  return sections
    .filter((section): section is ReactNode => Boolean(section))
    .flatMap((section, index) => (index === 0 ? [section] : [<MantineToolbar.Divider key={`divider-${index}`} />, section]));
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

/** An item in the "..." menu. A mousedown here would blur the canvas, so it is kept. */
function MoreMenuItem({
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
      onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </Menu.Item>
  );
}

/** The link menu's contents — shared by the toolbar button and the right-click
 * menu: the URL (opens in a new tab), Edit link, Remove link. */
/** What the right-click menu offers, based on what is under the pointer. */
interface EditorContextMenu {
  x: number;
  y: number;
  /** Set for plain text, where joining lines applies; `canJoin` is false when the selection is one line. */
  text?: boolean;
  canJoin?: boolean;
  link?: string;
  table?: { rows: number; columns: number };
  poetry?: boolean;
  spelling?: { word: string; language: SpellLanguage; suggestions: string[]; match: FindMatch };
  /** Synonyms of the word under the pointer; `items` is undefined while they load. */
  thesaurus?: { language: SpellLanguage; word: string; match: FindMatch; items?: string[] };
}

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

/** The table actions menu's contents — shared by the toolbar button and the
 * right-click menu. Each acts on the selected cell, or on every row/column a
 * multi-cell selection covers. */
function TableMenuItems({
  strings,
  direction,
  rows,
  columns,
  canMergeCells,
  canUnmergeCell,
  onAction,
}: {
  strings: Strings;
  direction: 'ltr' | 'rtl';
  /** Rows / columns the selection spans: more than one switches to the plural labels. */
  rows: number;
  columns: number;
  /** A multi-cell selection that can be collapsed into one cell. */
  canMergeCells: boolean;
  /** A caret in a single cell that already spans more than one row/column. */
  canUnmergeCell: boolean;
  onAction: (action: () => void) => () => void;
}) {
  const t = strings.tableMenu;
  // "Before" is the start side, which is on the right in an RTL table.
  const rtl = direction === 'rtl';
  const manyRows = rows > 1;
  const manyColumns = columns > 1;
  const item = (icon: TablerIcon, label: string, action: () => void, color?: string) => {
    const Icon = icon;
    return (
      <Menu.Item
        color={color}
        leftSection={<Icon size={ICON_SIZE} stroke={ICON_STROKE} />}
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        onClick={onAction(action)}
      >
        {label}
      </Menu.Item>
    );
  };
  return (
    <>
      <Menu.Label>{t.menuLabel}</Menu.Label>
      {item(IconRowInsertTop, manyRows ? t.insertRowsBefore : t.insertRowBefore, () => $insertTableRows(false))}
      {item(IconRowInsertBottom, manyRows ? t.insertRowsAfter : t.insertRowAfter, () => $insertTableRows(true))}
      {item(rtl ? IconColumnInsertRight : IconColumnInsertLeft, manyColumns ? t.insertColumnsBefore : t.insertColumnBefore, () =>
        $insertTableColumns(false),
      )}
      {item(rtl ? IconColumnInsertLeft : IconColumnInsertRight, manyColumns ? t.insertColumnsAfter : t.insertColumnAfter, () =>
        $insertTableColumns(true),
      )}
      {(canMergeCells || canUnmergeCell) && <Menu.Divider />}
      {canMergeCells && item(IconArrowMergeBoth, t.mergeCells, $mergeTableCells)}
      {canUnmergeCell && item(IconArrowsSplit2, t.unmergeCell, $unmergeTableCell)}
      <Menu.Divider />
      {item(IconRowRemove, manyRows ? t.deleteRows : t.deleteRow, $deleteTableRows)}
      {item(IconColumnRemove, manyColumns ? t.deleteColumns : t.deleteColumn, $deleteTableColumns)}
      {item(IconTableMinus, t.deleteTable, $deleteTable, 'red')}
    </>
  );
}

/** The poetry couplet menu's contents — layout (single/two-column) and
 * literal alignment, both per-instance overrides (requirements doc §4.11:
 * "set per CoupletNode, not inherited from a document-wide setting"), plus
 * table-row-style structural actions (insert a couplet above/below the one
 * the caret is in, delete it) — a poetry block is "one object with multiple
 * couplets, add/remove like table rows", so these mirror TableMenuItems'
 * own insert-before/insert-after/delete-row actions. */
/** The poetry block's current position on each adjustable scale. */
interface PoetryScale {
  spacing: PoetrySpacing;
  gutter: PoetryGutter;
  stagger: PoetryStagger;
}

/** Whether a one-notch step from `value` stays on the scale — a step that
 * would fall off either end is disabled rather than silently clamped. */
function canStep<T extends string>(scale: readonly T[], value: T, step: 1 | -1): boolean {
  const next = scale.indexOf(value) + step;
  return next >= 0 && next < scale.length;
}

function PoetryMenuItems({
  strings,
  layout,
  scale,
  centered,
  onAction,
}: {
  strings: Strings;
  layout: PoetryLayout;
  scale: PoetryScale;
  centered: boolean;
  onAction: (action: () => void) => () => void;
}) {
  const t = strings.poetryMenu;
  const item = (icon: TablerIcon, label: string, action: () => void, active = false, color?: string) => {
    const Icon = icon;
    return (
      <Menu.Item
        color={color}
        disabled={active}
        leftSection={<Icon size={ICON_SIZE} stroke={ICON_STROKE} />}
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        onClick={onAction(action)}
      >
        {label}
      </Menu.Item>
    );
  };
  const setLayout = (next: PoetryLayout) => () => {
    const node = $getPoetryBlockFromSelection();
    if (node) $setPoetryLayout(node, next);
  };
  return (
    <>
      <Menu.Label>{t.menuLabel}</Menu.Label>
      {item(IconColumns1, t.singleColumn, setLayout('single'), layout === 'single')}
      {item(IconColumns2, t.twoColumn, setLayout('two-column'), layout === 'two-column')}
      {item(IconArrowsShuffle, t.staggered, setLayout('staggered'), layout === 'staggered')}
      <Menu.Divider />
      <Menu.Divider />
      {item(IconRowInsertTop, t.insertCoupletBefore, () => $insertCoupletRelativeToSelection('before'))}
      {item(IconRowInsertBottom, t.insertCoupletAfter, () => $insertCoupletRelativeToSelection('after'))}
      {item(IconArrowsMinimize, t.tighterSpacing, () => $adjustPoetrySpacing(-1), !canStep(POETRY_SPACINGS, scale.spacing, -1))}
      {item(IconArrowsMaximize, t.looserSpacing, () => $adjustPoetrySpacing(1), !canStep(POETRY_SPACINGS, scale.spacing, 1))}
      {layout === 'staggered' && (
        <>
          {item(IconArrowsMinimize, t.narrowerCouplets, () => $adjustPoetryStagger(-1), !canStep(POETRY_STAGGERS, scale.stagger, -1))}
          {item(IconArrowsMaximize, t.widerCouplets, () => $adjustPoetryStagger(1), !canStep(POETRY_STAGGERS, scale.stagger, 1))}
        </>
      )}
      {layout === 'two-column' && (
        <>
          {item(IconAlignCenter, centered ? t.uncenterCouplet : t.centerCouplet, () => $setCoupletCentered(!centered))}
          {item(IconColumns2, t.narrowerGutter, () => $adjustPoetryGutter(-1), !canStep(POETRY_GUTTERS, scale.gutter, -1))}
          {item(IconColumns2, t.widerGutter, () => $adjustPoetryGutter(1), !canStep(POETRY_GUTTERS, scale.gutter, 1))}
        </>
      )}
      {item(IconTrash, t.deleteCouplet, $deletePoetryCouplet, false, 'red')}
      {item(IconTrash, t.deletePoetry, $deletePoetryBlock, false, 'red')}
    </>
  );
}

/** Appearance of the toolbar. The accent colour comes from the editor's `accentColor`. */
export interface ToolbarStyle {
  /** Outline the toolbar and each button cluster. Default true. */
  bordered?: boolean;
  /** `light` tints the active button, `filled` fills it with the accent. Default `light`. */
  variant?: 'light' | 'filled';
}

export interface ToolbarProps {
  config: ResolvedEditorFeatureConfig;
  toolbarStyle?: ToolbarStyle;
  /** Where synonyms come from. */
  thesaurusStores?: ThesaurusStore[];
  /** Where words added to the dictionary are saved. */
  dictionaryStores?: UserWordStore[];
  /** Opens the auto-correct panel with the word filled in. */
  onAddAutoCorrect?: (word: string, language: SpellLanguage) => void;
  /** Whether the find-and-replace widget is open, and how to toggle it (owned by EditorRoot). */
  findOpen?: boolean;
  onToggleFind?: () => void;
  /** Whether the spellcheck panel is open, and how to toggle it (owned by EditorRoot). */
  spellOpen?: boolean;
  onToggleSpell?: () => void;
  /** Whether the add-auto-correction panel is open, and how to toggle it (owned by EditorRoot). */
  autoCorrectOpen?: boolean;
  onToggleAutoCorrect?: () => void;
  onSave?: () => void;
  isDirty?: boolean;
  showSave?: boolean;
  /** Font-family dropdown entries; defaults to DEFAULT_FONT_OPTIONS. */
  fontOptions?: FontOption[];
  /** Text direction of the canvas; picks which default font and size are pre-selected. */
  direction?: 'ltr' | 'rtl';
  /** UI locale — picks the translated strings for labels, tooltips and menu items. */
  locale?: Locale;
  /** Autosave drafts: when set, the toolbar offers a Drafts button that lists and restores them. */
  drafts?: DraftsToolbarOptions;
}

export function Toolbar({ config, toolbarStyle, dictionaryStores = [], thesaurusStores = [], onAddAutoCorrect, onSave, isDirty, showSave, findOpen = false, onToggleFind, spellOpen = false, onToggleSpell, autoCorrectOpen = false, onToggleAutoCorrect, fontOptions = DEFAULT_FONT_OPTIONS, direction = 'ltr', locale = 'en', drafts }: ToolbarProps) {
  const bordered = toolbarStyle?.bordered ?? true;
  const variant = toolbarStyle?.variant ?? 'light';
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(INITIAL_STATE);
  const strings = useStrings(locale);
  const portalTarget = usePortalTarget();
  const [draftsOpen, setDraftsOpen] = useState(false);
  const rtl = direction === 'rtl';
  const ALIGN_ICONS = rtl ? ALIGN_ICONS_RTL : ALIGN_ICONS_LTR;

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      // A selection of several table cells isn't a range selection.
      if ($isTableSelection(selection)) {
        const { rows, columns } = $getTableSelectionSize();
        const canMergeCells = $canMergeSelectedCells();
        setState((s) => ({ ...s, inTable: true, tableRows: rows, tableColumns: columns, canMergeCells, canUnmergeCell: false, inPoetry: false }));
        return;
      }
      if (!$isRangeSelection(selection)) return;

      const anchorNode = selection.anchor.getNode();
      const inTable = $getTableCellNodeFromLexicalNode(anchorNode) !== null;
      const tableSize = inTable ? $getTableSelectionSize() : { rows: 1, columns: 1 };
      const canUnmergeCell = inTable && $canUnmergeSelectedCell();
      const poetryBlock = $getPoetryBlockFromSelection();
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
      const canJoinLines = $canJoinLines();
      const poetryLayout = poetryBlock?.getLayout();
      const poetryCentered = $getCoupletCenteredFromSelection();
      const poetryScale = poetryBlock
        ? { spacing: poetryBlock.getSpacing(), gutter: poetryBlock.getGutter(), stagger: poetryBlock.getStagger() }
        : null;

      setState((s) => ({
        ...s,
        canJoinLines,
        blockType,
        activeFormats,
        elementFormat,
        listType,
        fontFamily,
        fontSize,
        isLink,
        linkUrl,
        inTable,
        tableRows: tableSize.rows,
        tableColumns: tableSize.columns,
        canMergeCells: false,
        canUnmergeCell,
        inPoetry: poetryBlock !== null,
        poetryLayout: poetryLayout ?? s.poetryLayout,
        poetryScale: poetryScale ?? s.poetryScale,
        poetryCentered: poetryCentered ?? false,
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
  const runMenuItem = (action: () => void) => () => {
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

  const [tableDialogOpen, setTableDialogOpen] = useState(false);

  const openTableDialog = () => {
    snapshotSelection();
    setTableDialogOpen(true);
  };

  const closeTableDialog = () => {
    setTableDialogOpen(false);
    editor.focus();
  };

  const insertTable = ({ rows, columns, headerRow }: TableDialogValue) => {
    const saved = menuSelectionRef.current;
    if (saved) editor.update(() => $setSelection(saved.clone()), { discrete: true });
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      rows: String(rows),
      columns: String(columns),
      includeHeaders: { rows: headerRow, columns: false },
    });
    closeTableDialog();
  };

  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);

  const openLayoutDialog = () => {
    snapshotSelection();
    setLayoutDialogOpen(true);
  };

  const closeLayoutDialog = () => {
    setLayoutDialogOpen(false);
    editor.focus();
  };

  const insertLayout = ({ columnCount }: LayoutDialogValue) => {
    const saved = menuSelectionRef.current;
    if (saved) editor.update(() => $setSelection(saved.clone()), { discrete: true });
    editor.dispatchCommand(INSERT_LAYOUT_COMMAND, { columnCount });
    closeLayoutDialog();
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

  // One right-click menu for the whole editor, replacing the browser's own. It
  // adds what applies to what is under the pointer (a spelling fix, a link, a
  // table cell, a poetry couplet) and always offers cut, copy, paste and select all.
  const runMenuAction = (action: () => void) => () => {
    restoreSelection();
    editor.update(action);
    editor.focus();
  };

  const [contextMenu, setContextMenu] = useState<EditorContextMenu | null>(null);

  useEffect(() => {
    const onContextMenu = async (event: MouseEvent) => {
      event.preventDefault();
      snapshotSelectionRef.current();
      const target = event.target as HTMLElement | null;
      const anchor = config.links ? (target?.closest?.('a') ?? null) : null;
      const cell = config.tables ? (target?.closest?.('td, th') ?? null) : null;
      const couplet = config.poetry.enabled ? (target?.closest?.('.likhari-poetry') ?? null) : null;
      const point = config.language.spellCheck || config.language.thesaurus ? textPointAt(event.clientX, event.clientY) : null;
      const menu: EditorContextMenu = { x: event.clientX, y: event.clientY };
      let word = null as WordAtPoint | null;

      editor.update(
        () => {
          if (anchor) {
            const node = $getNearestNodeFromDOMNode(anchor);
            const link = node ? $findMatchingParent(node, $isLinkNode) : null;
            if ($isLinkNode(link)) {
              menu.link = link.getURL();
              // Select the whole link first, so Edit / Remove act on it wherever the caret was.
              link.select(0, link.getChildrenSize());
            }
          }
          if (cell) {
            const node = $getNearestNodeFromDOMNode(cell);
            const tableCell = node ? $getTableCellNodeFromLexicalNode(node) : null;
            if (tableCell) {
              const selection = $getSelection();
              // Keep a multi-cell selection that includes this cell.
              const insideSelection =
                $isTableSelection(selection) && selection.getNodes().some((n) => n.getKey() === tableCell.getKey());
              if (!insideSelection) tableCell.selectEnd();
              const size = $getTableSelectionSize();
              menu.table = { rows: size.rows, columns: size.columns };
            }
          }
          if (couplet) {
            const node = $getNearestNodeFromDOMNode(couplet);
            const block = node ? $findMatchingParent(node, $isPoetryBlockNode) : null;
            if (block) {
              menu.poetry = true;
              if (!$getPoetryBlockFromSelection()) block.selectStart();
            }
          }
          if (point) word = $wordAtDomPoint(point.node, point.offset);
          if (!cell && !couplet) {
            menu.text = true;
            menu.canJoin = $canJoinLines();
          }
        },
        { discrete: true },
      );

      const language: SpellLanguage = word?.direction === 'rtl' ? 'ur' : 'en';
      if (word && config.language.thesaurus) {
        menu.thesaurus = { language, word: word.word, match: word.match };
      }
      if (word && config.language.spellCheck) {
        const speller = getSpeller(language);
        if (speller) {
          const checked = await speller;
          if (!checked.correct(word.word)) {
            menu.spelling = { word: word.word, language, suggestions: checked.suggest(word.word).slice(0, 5), match: word.match };
          }
        }
      }
      setContextMenu(menu);
      if (word && menu.thesaurus) {
        // Synonyms can take a while (the first WordNet lookup downloads the database), so the menu
        // is already open and fills in when they arrive, unless the user has moved on.
        const items = await lookupSynonyms(thesaurusStores, word.word, language);
        setContextMenu((current) =>
          current && current.x === menu.x && current.y === menu.y && current.thesaurus
            ? { ...current, thesaurus: { ...current.thesaurus, items } }
            : current,
        );
      }
    };
    return editor.registerRootListener((root, previous) => {
      previous?.removeEventListener('contextmenu', onContextMenu);
      root?.addEventListener('contextmenu', onContextMenu);
    });
  }, [editor, config.links, config.tables, config.poetry.enabled, config.language.spellCheck, config.language.thesaurus, thesaurusStores]);

  // Cut and copy put the selected text on the clipboard as plain text.
  const copyOrCut = (cut: boolean) => async () => {
    restoreSelection();
    let text = '';
    editor.update(
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        text = selection.getTextContent();
        if (cut) selection.removeText();
      },
      { discrete: true },
    );
    if (text) await navigator.clipboard?.writeText(text).catch(() => undefined);
    editor.focus();
  };

  // Paste reads plain text from the clipboard (the browser may ask for permission).
  const paste = async () => {
    restoreSelection();
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    editor.update(
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        text.split(/\r?\n/).forEach((line, index) => {
          if (index > 0) selection.insertParagraph();
          selection.insertText(line);
        });
      },
      { discrete: true },
    );
    editor.focus();
  };

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
  const showAlignGroup =
    config.alignment.start || config.alignment.center || config.alignment.justify || config.alignment.left || config.alignment.right;
  const showInsertGroup =
    config.links ||
    config.images.linked ||
    config.images.embedded ||
    config.tables ||
    config.blocks.horizontalRule ||
    config.blocks.pageBreak ||
    config.columns ||
    config.footnotes ||
    (config.poetry.enabled && locale !== 'en') ||
    (config.tables && state.inTable) ||
    (config.poetry.enabled && state.inPoetry);

  const moreItems: ActionItem[] = [];
  if (fmt.superscript) {
    moreItems.push({
      key: 'superscript',
      icon: IconSuperscript,
      label: strings.toolbar.superscript,
      active: state.activeFormats.has('superscript'),
      onClick: () => formatText('superscript'),
    });
  }
  if (fmt.subscript) {
    moreItems.push({
      key: 'subscript',
      icon: IconSubscript,
      label: strings.toolbar.subscript,
      active: state.activeFormats.has('subscript'),
      onClick: () => formatText('subscript'),
    });
  }
  if (fmt.caseTransforms) {
    moreItems.push(
      { key: 'upper', icon: IconLetterCaseUpper, label: strings.toolbar.uppercase, onClick: () => applyCaseTransform('upper') },
      { key: 'lower', icon: IconLetterCaseLower, label: strings.toolbar.lowercase, onClick: () => applyCaseTransform('lower') },
      { key: 'capitalize', icon: IconLetterCase, label: strings.toolbar.capitalize, onClick: () => applyCaseTransform('capitalize') },
    );
  }
  if (fmt.clearFormatting) {
    moreItems.push({ key: 'clear', icon: IconClearFormatting, label: strings.toolbar.clearFormatting, onClick: clearFormatting });
  }

  // UI spec §5: indent/outdent arrows are direction-relative and swap in RTL
  // (outdent moves content toward the start edge, which is the right in RTL).
  const indentItems: ActionItem[] = config.indent
    ? [
        {
          key: 'outdent',
          icon: rtl ? IconIndentIncrease : IconIndentDecrease,
          label: strings.toolbar.outdent,
          onClick: () => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
        },
        {
          key: 'indent',
          icon: rtl ? IconIndentDecrease : IconIndentIncrease,
          label: strings.toolbar.indent,
          onClick: () => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
        },
      ]
    : [];

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

  const formatSection = (showFormattingGroup || fmt.bold || fmt.italic || fmt.underline || fmt.strikethrough || moreItems.length > 0) && (
    <Fragment key="format">
      {showFormattingGroup && (
        <MantineToolbar.Group>
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
        </MantineToolbar.Group>
      )}
      {(fmt.bold || fmt.italic || fmt.underline || fmt.strikethrough || moreItems.length > 0) && (
    <MantineToolbar.Group className="likhari-toolbar-cluster">
      {fmt.bold && <ToolbarButton icon={IconBold} title={strings.toolbar.bold} active={state.activeFormats.has('bold')} onClick={() => formatText('bold')} />}
      {fmt.italic && (
        <ToolbarButton icon={IconItalic} title={strings.toolbar.italic} active={state.activeFormats.has('italic')} onClick={() => formatText('italic')} />
      )}
      {fmt.underline && (
        <ToolbarButton icon={IconUnderline} title={strings.toolbar.underline} active={state.activeFormats.has('underline')} onClick={() => formatText('underline')} />
      )}
      {fmt.strikethrough && (
        <ToolbarButton
          icon={IconStrikethrough}
          title={strings.toolbar.strikethrough}
          active={state.activeFormats.has('strikethrough')}
          onClick={() => formatText('strikethrough')}
        />
      )}
      {moreItems.length > 0 && (
        <Menu position="bottom-start" withinPortal portalProps={{ target: portalTarget }} shadow="sm" width={210} closeOnItemClick onOpen={snapshotSelection}>
          <Menu.Target>
            <ToolbarButton icon={IconDots} title={strings.toolbar.moreFormatting} />
          </Menu.Target>
          <Menu.Dropdown>
            {moreItems.map((item) => (
              <MoreMenuItem key={item.key} icon={item.icon} label={item.label} active={item.active} onClick={runMenuItem(item.onClick)} />
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </MantineToolbar.Group>)}
    </Fragment>
  );

  const alignSection = (showAlignGroup || indentItems.length > 0) && (
    <Fragment key="align">
      {showAlignGroup && (
        <MantineToolbar.Group>
          <ToolbarSelect
            icon={AlignIcon}
            label={strings.toolbar.alignment}
            width={138}
            value={state.elementFormat || 'start'}
            data={alignOptions}
            renderOption={iconOptionRenderer(ALIGN_ICONS as Record<string, TablerIcon>, IconAlignLeft)}
            onChange={withRefocus((v) => formatElement(v as ElementFormatType))}
          />
        </MantineToolbar.Group>
      )}
      {indentItems.length > 0 && (
        <MantineToolbar.Group className="likhari-toolbar-cluster">
          {indentItems.map((item) => (
            <ToolbarButton key={item.key} icon={item.icon} title={item.label} onClick={item.onClick} />
          ))}
        </MantineToolbar.Group>
      )}
    </Fragment>
  );

  const fontSection = (config.font.family || config.font.size) && (
    <MantineToolbar.Group key="font">
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
    </MantineToolbar.Group>
  );

  const insertSection = showInsertGroup && (
    <MantineToolbar.Group key="insert" className="likhari-toolbar-cluster">
      {config.links &&
        (state.isLink ? (
          <Menu position="bottom-start" withinPortal portalProps={{ target: portalTarget }} shadow="sm" width={240} onOpen={snapshotSelection}>
            <Menu.Target>
              <ToolbarButton icon={IconLink} title={strings.toolbar.linkOptions} active aria-haspopup="menu" />
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
        ))}
      {(config.images.linked || config.images.embedded) && (
        <ToolbarButton icon={IconPhoto} title={strings.toolbar.insertImage} onClick={openImageDialog} />
      )}
      {config.blocks.horizontalRule && (
        <ToolbarButton
          icon={IconSeparatorHorizontal}
          title={strings.toolbar.insertHorizontalRule}
          onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
        />
      )}
      {config.tables && <ToolbarButton icon={IconTable} title={strings.toolbar.insertTable} onClick={openTableDialog} />}
      {config.tables && state.inTable && (
        <Menu position="bottom-start" withinPortal portalProps={{ target: portalTarget }} shadow="sm" width={240} onOpen={snapshotSelection}>
          <Menu.Target>
            <ToolbarButton icon={IconTableOptions} title={strings.toolbar.tableOptions} active aria-haspopup="menu" />
          </Menu.Target>
          <Menu.Dropdown>
            <TableMenuItems
              strings={strings}
              direction={direction}
              rows={state.tableRows}
              columns={state.tableColumns}
              canMergeCells={state.canMergeCells}
              canUnmergeCell={state.canUnmergeCell}
              onAction={runMenuAction}
            />
          </Menu.Dropdown>
        </Menu>
      )}
      {config.columns && <ToolbarButton icon={IconColumns} title={strings.toolbar.insertColumns} onClick={openLayoutDialog} />}
      {config.footnotes && (
        <ToolbarButton
          icon={IconNumber1Small}
          title={strings.toolbar.insertFootnote}
          onClick={() => editor.dispatchCommand(INSERT_FOOTNOTE_COMMAND, undefined)}
        />
      )}
      {config.blocks.pageBreak && (
        <ToolbarButton
          icon={IconPageBreak}
          title={strings.toolbar.insertPageBreak}
          onClick={() => editor.dispatchCommand(INSERT_PAGE_BREAK_COMMAND, undefined)}
        />
      )}
      {/* UI spec §3.1 item 8: poetry mode is hidden entirely (not greyed out)
          outside an Urdu/Punjabi editing context, not just when the feature is off. */}
      {config.poetry.enabled && locale !== 'en' && (
        <ToolbarButton
          icon={IconFeather}
          title={strings.toolbar.insertPoetryCouplet}
          onClick={() => editor.dispatchCommand(INSERT_POETRY_COUPLET_COMMAND, { layout: config.poetry.defaultLayout })}
        />
      )}
      {config.poetry.enabled && state.inPoetry && (
        <Menu position="bottom-start" withinPortal portalProps={{ target: portalTarget }} shadow="sm" width={200} onOpen={snapshotSelection}>
          <Menu.Target>
            <ToolbarButton icon={IconFeather} title={strings.toolbar.poetryOptions} active aria-haspopup="menu" />
          </Menu.Target>
          <Menu.Dropdown>
            <PoetryMenuItems strings={strings} layout={state.poetryLayout} scale={state.poetryScale} centered={state.poetryCentered} onAction={runMenuAction} />
          </Menu.Dropdown>
        </Menu>
      )}
    </MantineToolbar.Group>
  );

  const joinLines = () => {
    editor.update(() => {
      $joinSelectedLines();
    }, { discrete: true });
    editor.focus();
  };

  const toolsSection = (
    <MantineToolbar.Group key="tools" className="likhari-toolbar-cluster">
      {config.language.autocorrect && (
        <ToolbarButton icon={IconWand} title={strings.toolbar.autocorrect} active={autoCorrectOpen} onClick={onToggleAutoCorrect} />
      )}
      {config.language.textCleanup && (
        <ToolbarButton
          icon={IconSparkles}
          title={strings.autoCorrect.correctDocument}
          onClick={() => editor.dispatchCommand(CORRECT_DOCUMENT_COMMAND, undefined)}
        />
      )}
      {config.language.spellCheck && (
        <ToolbarButton icon={IconAbc} title={strings.toolbar.spellChecker} active={spellOpen} onClick={onToggleSpell} />
      )}
      <ToolbarButton icon={IconArrowsJoin} title={strings.toolbar.joinLines} disabled={!state.canJoinLines} onClick={joinLines} />
    </MantineToolbar.Group>
  );

  const endSection = (drafts || config.findReplace) && (
    <MantineToolbar.Group key="end" className="likhari-toolbar-cluster" style={{ marginInlineStart: 'auto' }}>
      {drafts && <ToolbarButton icon={IconHistory} title={strings.toolbar.drafts} onClick={() => setDraftsOpen(true)} />}
      {config.findReplace && (
        <ToolbarButton icon={IconSearch} title={strings.findReplace.toggle} active={findOpen} onClick={onToggleFind} />
      )}
    </MantineToolbar.Group>
  );

  const startSections: (ReactNode | false)[] = [
    showSave && (
      <MantineToolbar.Group key="save" className="likhari-toolbar-cluster">
        <ToolbarButton icon={IconDeviceFloppy} title={strings.toolbar.save} dirty={Boolean(isDirty)} onClick={onSave} />
      </MantineToolbar.Group>
    ),
    config.history && (
      <MantineToolbar.Group key="history" className="likhari-toolbar-cluster">
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
      </MantineToolbar.Group>
    ),
    formatSection,
    alignSection,
    fontSection,
    insertSection,
    toolsSection,
  ];

  return (
    <MantineToolbar
      aria-label={strings.toolbar.ariaLabel}
      className={bordered ? 'likhari-toolbar' : 'likhari-toolbar likhari-toolbar--plain'}
      withBorder={bordered}
      variant={variant}
      color="var(--editor-accent)"
    >
      {withDividers(startSections)}
      {endSection}

      <Menu
        opened={contextMenu !== null}
        onChange={(opened) => {
          if (!opened) setContextMenu(null);
        }}
        position="bottom-start"
        withinPortal
        portalProps={{ target: portalTarget }}
        shadow="sm"
        width={260}
      >
        <Menu.Target>
          {/* Invisible 1px anchor positioned at the right-click */}
          <span
            aria-hidden="true"
            style={{ position: 'fixed', left: contextMenu?.x ?? -9999, top: contextMenu?.y ?? -9999, width: 1, height: 1, pointerEvents: 'none' }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          {contextMenu?.spelling && (
            <>
              <Menu.Label>{strings.contextMenu.spelling}</Menu.Label>
              {contextMenu.spelling.suggestions.length === 0 && <Menu.Item disabled>{strings.contextMenu.noSuggestions}</Menu.Item>}
              {contextMenu.spelling.suggestions.map((suggestion) => (
                <Menu.Item
                  key={suggestion}
                  onClick={() => {
                    const match = contextMenu.spelling!.match;
                    editor.update(() => $replaceMatch(match, suggestion), { discrete: true });
                    editor.focus();
                  }}
                >
                  {suggestion}
                </Menu.Item>
              ))}
              <Menu.Item
                onClick={() => {
                  ignoreWord(contextMenu.spelling!.language, contextMenu.spelling!.word);
                  setContextMenu(null);
                }}
              >
                {strings.contextMenu.ignore}
              </Menu.Item>
              <Menu.Item
                onClick={() => {
                  const { language, word } = contextMenu.spelling!;
                  // Without a writable store, the word is ignored for this session instead.
                  void addUserWord(dictionaryStores, language, word).then((added) => {
                    if (!added) ignoreWord(language, word);
                  });
                  setContextMenu(null);
                }}
              >
                {strings.contextMenu.addToDictionary}
              </Menu.Item>
              {onAddAutoCorrect && config.language.autocorrect && (
                <Menu.Item
                  onClick={() => {
                    onAddAutoCorrect(contextMenu.spelling!.word, contextMenu.spelling!.language);
                    setContextMenu(null);
                  }}
                >
                  {strings.contextMenu.addToAutoCorrect}
                </Menu.Item>
              )}
              <Menu.Divider />
            </>
          )}
          {contextMenu?.thesaurus && (
            <>
              <Menu.Label>{strings.thesaurus.synonyms}</Menu.Label>
              {contextMenu.thesaurus.items === undefined && <Menu.Item disabled>{strings.thesaurus.loading}</Menu.Item>}
              {contextMenu.thesaurus.items?.length === 0 && <Menu.Item disabled>{strings.thesaurus.none}</Menu.Item>}
              {contextMenu.thesaurus.items?.map((synonym) => (
                <Menu.Item
                  key={synonym}
                  onClick={() => {
                    const match = contextMenu.thesaurus!.match;
                    editor.update(() => $replaceMatch(match, synonym), { discrete: true });
                    editor.focus();
                  }}
                >
                  {synonym}
                </Menu.Item>
              ))}
              <Menu.Divider />
            </>
          )}
          {contextMenu?.link !== undefined && (
            <>
              <LinkMenuItems
                url={contextMenu.link}
                onEdit={() => {
                  restoreSelection();
                  openLinkDialog();
                }}
                onRemove={removeLink}
                strings={strings}
              />
              <Menu.Divider />
            </>
          )}
          {contextMenu?.table && (
            <>
              <TableMenuItems
                strings={strings}
                direction={direction}
                rows={contextMenu.table.rows}
                columns={contextMenu.table.columns}
                canMergeCells={state.canMergeCells}
                canUnmergeCell={state.canUnmergeCell}
                onAction={runMenuAction}
              />
              <Menu.Divider />
            </>
          )}
          {contextMenu?.poetry && (
            <>
              <PoetryMenuItems strings={strings} layout={state.poetryLayout} scale={state.poetryScale} centered={state.poetryCentered} onAction={runMenuAction} />
              <Menu.Divider />
            </>
          )}
          {contextMenu?.text && (
            <>
              <Menu.Item
                leftSection={<IconArrowsJoin size={ICON_SIZE} stroke={ICON_STROKE} />}
                disabled={!contextMenu.canJoin}
                onClick={runMenuAction(() => {
                  $joinSelectedLines();
                })}
              >
                {strings.contextMenu.joinLines}
              </Menu.Item>
              <Menu.Divider />
            </>
          )}
          <Menu.Item leftSection={<IconCut size={ICON_SIZE} stroke={ICON_STROKE} />} onClick={() => void copyOrCut(true)()}>
            {strings.contextMenu.cut}
          </Menu.Item>
          <Menu.Item leftSection={<IconCopy size={ICON_SIZE} stroke={ICON_STROKE} />} onClick={() => void copyOrCut(false)()}>
            {strings.contextMenu.copy}
          </Menu.Item>
          <Menu.Item leftSection={<IconClipboard size={ICON_SIZE} stroke={ICON_STROKE} />} onClick={() => void paste()}>
            {strings.contextMenu.paste}
          </Menu.Item>
          <Menu.Item leftSection={<IconSelectAll size={ICON_SIZE} stroke={ICON_STROKE} />} onClick={runMenuAction(() => $selectAll())}>
            {strings.contextMenu.selectAll}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {(config.images.linked || config.images.embedded) && (
        <ImageDialog mode="insert" opened={imageDialogOpen} onSubmit={insertImage} onClose={closeImageDialog} />
      )}
      {config.tables && <TableDialog opened={tableDialogOpen} onSubmit={insertTable} onClose={closeTableDialog} />}
      {config.columns && <LayoutDialog opened={layoutDialogOpen} onSubmit={insertLayout} onClose={closeLayoutDialog} />}
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
      {drafts && <DraftsDialog opened={draftsOpen} locale={locale} onClose={() => setDraftsOpen(false)} {...drafts} />}
    </MantineToolbar>
  );
}
