import {
  $computeTableMap,
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $getTableCellNodeFromLexicalNode,
  $getTableCellNodeRect,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableSelection,
  $unmergeCell,
  type TableCellNode,
} from '@lexical/table';
import { $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical';

/** Table cells the selection covers: the caret's own cell, or every cell of a
 * multi-cell selection. Empty when the selection isn't in a table. */
function $selectedCells(): TableCellNode[] {
  const selection = $getSelection();
  if ($isTableSelection(selection)) return selection.getNodes().filter($isTableCellNode);
  if ($isRangeSelection(selection)) {
    const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
    return cell ? [cell] : [];
  }
  return [];
}

/** How many rows and columns the selection spans (1 × 1 for a caret in a cell, 0 × 0 outside a table). */
export function $getTableSelectionSize(): { rows: number; columns: number } {
  const cells = $selectedCells();
  if (cells.length === 0) return { rows: 0, columns: 0 };
  const rows = cells.map($getTableRowIndexFromTableCellNode);
  const columns = cells.map($getTableColumnIndexFromTableCellNode);
  return {
    rows: Math.max(...rows) - Math.min(...rows) + 1,
    columns: Math.max(...columns) - Math.min(...columns) + 1,
  };
}

/**
 * Inserts as many rows as the selection spans, before its first row or after
 * its last. Lexical's own insert works from the selection's focus cell and adds
 * one row, so with several rows selected it would land mid-selection.
 */
export function $insertTableRows(insertAfter: boolean): void {
  const cells = $selectedCells();
  if (cells.length === 0) return;
  const rows = cells.map($getTableRowIndexFromTableCellNode);
  const first = Math.min(...rows);
  const last = Math.max(...rows);
  // Park the caret in a cell on the edge row; every insert then lands right next to it.
  cells[rows.indexOf(insertAfter ? last : first)].selectEnd();
  for (let i = 0; i <= last - first; i++) $insertTableRow__EXPERIMENTAL(insertAfter);
}

/** Like $insertTableRows, for columns. "Before" is the column index below the
 * first selected one (the right-hand side in a right-to-left table). */
export function $insertTableColumns(insertAfter: boolean): void {
  const cells = $selectedCells();
  if (cells.length === 0) return;
  const columns = cells.map($getTableColumnIndexFromTableCellNode);
  const first = Math.min(...columns);
  const last = Math.max(...columns);
  cells[columns.indexOf(insertAfter ? last : first)].selectEnd();
  for (let i = 0; i <= last - first; i++) $insertTableColumn__EXPERIMENTAL(insertAfter);
}

/** Deletes every row the selection touches (Lexical handles a multi-cell selection). */
export function $deleteTableRows(): void {
  $deleteTableRow__EXPERIMENTAL();
}

/** Deletes every column the selection touches. */
export function $deleteTableColumns(): void {
  $deleteTableColumn__EXPERIMENTAL();
}

/** Removes the whole table the selection is in. */
export function $deleteTable(): void {
  const selection = $getSelection();
  const anchor = $isRangeSelection(selection) || $isTableSelection(selection) ? selection.anchor.getNode() : null;
  if (anchor) $getTableNodeFromLexicalNodeOrThrow(anchor).remove();
}

/** True for a selection spanning more than one cell — the only shape a merge can apply to. */
export function $canMergeSelectedCells(): boolean {
  const selection = $getSelection();
  if (!$isTableSelection(selection)) return false;
  return selection.getNodes().filter($isTableCellNode).length > 1;
}

/** True for a caret parked in a single cell that already spans more than one row/column. */
export function $canUnmergeSelectedCell(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
  return cell !== null && (cell.getColSpan() > 1 || cell.getRowSpan() > 1);
}

/**
 * Merges every cell the (multi-cell) selection spans into a single cell at
 * its top-left corner, moving their content there and growing its colSpan/
 * rowSpan to cover the vacated space. No-ops on an irregular selection shape
 * (one that would cut an already-merged cell in half).
 */
export function $mergeTableCells(): void {
  const selection = $getSelection();
  if (!$isTableSelection(selection)) return;
  if (selection.getNodes().filter($isTableCellNode).length < 2) return;

  const anchorCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
  const focusCell = $getTableCellNodeFromLexicalNode(selection.focus.getNode());
  if (!anchorCell || !focusCell) return;

  const tableNode = $getTableNodeFromLexicalNodeOrThrow(anchorCell);
  const [map, anchorValue, focusValue] = $computeTableMap(tableNode, anchorCell, focusCell);
  // Bounding rectangle of the two endpoint cells, each expanded by its own
  // span, so a selection that starts or ends on an already-merged cell still
  // captures that cell's full extent.
  const boundary = {
    minRow: Math.min(anchorValue.startRow, focusValue.startRow),
    minColumn: Math.min(anchorValue.startColumn, focusValue.startColumn),
    maxRow: Math.max(
      anchorValue.startRow + anchorValue.cell.getRowSpan() - 1,
      focusValue.startRow + focusValue.cell.getRowSpan() - 1,
    ),
    maxColumn: Math.max(
      anchorValue.startColumn + anchorValue.cell.getColSpan() - 1,
      focusValue.startColumn + focusValue.cell.getColSpan() - 1,
    ),
  };

  // Collect the distinct cell nodes the rectangle covers, bailing out if any
  // of them extends past the rectangle (merging would silently truncate it).
  const cellsInRect = new Set<TableCellNode>();
  for (let r = boundary.minRow; r <= boundary.maxRow; r++) {
    for (let c = boundary.minColumn; c <= boundary.maxColumn; c++) {
      cellsInRect.add(map[r][c].cell);
    }
  }
  for (const cell of cellsInRect) {
    const rect = $getTableCellNodeRect(cell);
    if (!rect) continue;
    const exceedsTop = rect.rowIndex < boundary.minRow;
    const exceedsLeft = rect.columnIndex < boundary.minColumn;
    const exceedsBottom = rect.rowIndex + rect.rowSpan - 1 > boundary.maxRow;
    const exceedsRight = rect.columnIndex + rect.colSpan - 1 > boundary.maxColumn;
    if (exceedsTop || exceedsLeft || exceedsBottom || exceedsRight) return;
  }

  const topLeft = map[boundary.minRow][boundary.minColumn].cell;

  for (const cell of cellsInRect) {
    if (cell === topLeft) continue;
    for (const child of cell.getChildren()) {
      topLeft.append(child);
    }
    const row = cell.getParent();
    cell.remove();
    if (row && row.getChildrenSize() === 0) row.remove();
  }

  if (topLeft.getChildrenSize() === 0) {
    topLeft.append($createParagraphNode());
  }

  topLeft.setRowSpan(boundary.maxRow - boundary.minRow + 1);
  topLeft.setColSpan(boundary.maxColumn - boundary.minColumn + 1);
  topLeft.selectEnd();
}

/** Splits the selected (already-merged) cell back into separate 1x1 cells. */
export function $unmergeTableCell(): void {
  $unmergeCell();
}
