import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableSelection,
  type TableCellNode,
} from '@lexical/table';
import { $getSelection, $isRangeSelection } from 'lexical';

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
