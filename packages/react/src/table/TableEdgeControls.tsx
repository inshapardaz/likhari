import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getTableCellNodeFromLexicalNode } from '@lexical/table';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { $getSelection, $isRangeSelection } from 'lexical';
import { usePortalTarget } from '../PortalTargetContext';
import { useUiStrings } from '../i18n/useStrings';
import { $deleteTableColumns, $deleteTableRows, $insertTableColumns, $insertTableRows } from './tableActions';

/** Thickness of an insert zone; it straddles the border it sits on. */
const ZONE_PX = 14;
/** Thickness of a delete handle, and the gap keeping it clear of the
 * insert zone on the same edge. */
const HANDLE_PX = 18;
const HANDLE_GAP_PX = ZONE_PX / 2 + 2;
/** How far in from the table's edge the row/column insert buttons sit. */
const BUTTON_INSET_PX = 10;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Geometry {
  table: Rect;
  row: Rect;
  /** The caret cell's horizontal extent — the column (or, for a merged
   * cell, the columns) a column action applies to. */
  column: Rect;
  rtl: boolean;
}

function toRect(el: Element): Rect {
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * Hover affordances on the caret's table row and column, mirroring
 * PoetryCoupletInserter: a "+" on the row's top and bottom borders (insert
 * row before/after) and on the column's start and end borders (insert
 * column before/after), plus a delete handle just outside the table at the
 * row's start edge and above the column. Everything acts through the
 * existing tableActions on the caret's cell, so the caret is kept where it
 * is (mousedown is suppressed) and the result matches the table menu's own
 * actions. Portaled beside the editor's DOM, never inside the table.
 */
export function TableEdgeControls() {
  const [editor] = useLexicalComposerContext();
  const portalSelector = usePortalTarget();
  const strings = useUiStrings();
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    const recompute = () => {
      if (!editor.isEditable()) {
        setGeometry(null);
        return;
      }
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        const cell = $isRangeSelection(selection) ? $getTableCellNodeFromLexicalNode(selection.anchor.getNode()) : null;
        const cellEl = cell ? editor.getElementByKey(cell.getKey()) : null;
        const rowEl = cellEl?.closest('tr');
        const tableEl = cellEl?.closest('table');
        if (!cellEl || !rowEl || !tableEl) {
          setGeometry(null);
          return;
        }
        setGeometry({
          table: toRect(tableEl),
          row: toRect(rowEl),
          column: toRect(cellEl),
          rtl: getComputedStyle(tableEl).direction === 'rtl',
        });
      });
    };
    recompute();
    const unregisterUpdate = editor.registerUpdateListener(recompute);
    const unregisterEditable = editor.registerEditableListener(recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      unregisterUpdate();
      unregisterEditable();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [editor]);

  if (!geometry) return null;
  const { table, row, column, rtl } = geometry;
  const t = strings.tableMenu;

  const run = (action: () => void) => () => {
    editor.update(action);
  };

  const control = (
    key: string,
    label: string,
    style: React.CSSProperties,
    onClick: () => void,
    options: { vertical?: boolean; danger?: boolean } = {},
  ) => (
    <div
      key={key}
      className={`likhari-edge-zone${options.vertical ? ' likhari-edge-zone--vertical' : ''}${options.danger ? ' likhari-edge-zone--handle' : ''}`}
      style={{ position: 'fixed', ...style }}
    >
      <button
        type="button"
        className={`likhari-edge-button${options.danger ? ' likhari-edge-button--danger' : ''}`}
        title={label}
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        {options.danger ? <IconTrash size={12} stroke={2} /> : <IconPlus size={12} stroke={2.5} />}
      </button>
    </div>
  );

  // "Before" is the start side: the left border of the column in LTR, the right one in RTL.
  const columnStartX = rtl ? column.left + column.width : column.left;
  const columnEndX = rtl ? column.left : column.left + column.width;
  const rowHandleX = rtl ? table.left + table.width + HANDLE_GAP_PX : table.left - HANDLE_GAP_PX - HANDLE_PX;
  // Row buttons sit at the row's start edge and column buttons at the top of
  // the table, rather than both at the centre where the two kinds of zone
  // cross (and so would hide each other's button).
  const rowZone: React.CSSProperties = { justifyContent: rtl ? 'flex-end' : 'flex-start', paddingInline: BUTTON_INSET_PX };
  const columnZone: React.CSSProperties = { alignItems: 'flex-start', paddingBlock: BUTTON_INSET_PX };

  const controls = (
    <>
      {control(
        'row-before',
        t.insertRowBefore,
        { top: row.top - ZONE_PX / 2, left: table.left, width: table.width, height: ZONE_PX, ...rowZone },
        run(() => $insertTableRows(false)),
      )}
      {control(
        'row-after',
        t.insertRowAfter,
        { top: row.top + row.height - ZONE_PX / 2, left: table.left, width: table.width, height: ZONE_PX, ...rowZone },
        run(() => $insertTableRows(true)),
      )}
      {control(
        'column-before',
        t.insertColumnBefore,
        { top: table.top, left: columnStartX - ZONE_PX / 2, width: ZONE_PX, height: table.height, ...columnZone },
        run(() => $insertTableColumns(false)),
        { vertical: true },
      )}
      {control(
        'column-after',
        t.insertColumnAfter,
        { top: table.top, left: columnEndX - ZONE_PX / 2, width: ZONE_PX, height: table.height, ...columnZone },
        run(() => $insertTableColumns(true)),
        { vertical: true },
      )}
      {control(
        'row-delete',
        t.deleteRow,
        { top: row.top, left: rowHandleX, width: HANDLE_PX, height: row.height },
        run($deleteTableRows),
        { vertical: true, danger: true },
      )}
      {control(
        'column-delete',
        t.deleteColumn,
        { top: table.top - HANDLE_GAP_PX - HANDLE_PX, left: column.left, width: column.width, height: HANDLE_PX },
        run($deleteTableColumns),
        { danger: true },
      )}
    </>
  );

  const portalRoot = portalSelector ? document.querySelector(portalSelector) : null;
  return portalRoot ? createPortal(controls, portalRoot) : controls;
}
