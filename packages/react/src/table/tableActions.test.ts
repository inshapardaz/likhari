import { describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, $setSelection, createEditor, type LexicalEditor } from 'lexical';
import {
  $createTableNodeWithDimensions,
  $createTableSelection,
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  type TableNode as TableNodeType,
} from '@lexical/table';
import {
  $deleteTable,
  $deleteTableColumns,
  $deleteTableRows,
  $getTableSelectionSize,
  $insertTableColumns,
  $insertTableRows,
} from './tableActions';

function makeEditor(): LexicalEditor {
  return createEditor({ namespace: 'test', nodes: [TableNode, TableRowNode, TableCellNode], onError: (e) => { throw e; } });
}

/** A 4x4 table whose cells read "11".."44". Returns an editor ready for actions. */
function withTable(editor: LexicalEditor): void {
  editor.update(
    () => {
      const table = $createTableNodeWithDimensions(4, 4, false);
      table.getChildren().forEach((row, r) => {
        (row as TableRowNode).getChildren().forEach((cell, c) => {
          const paragraph = (cell as TableCellNode).getFirstChild() ?? $createParagraphNode();
          if (!(cell as TableCellNode).getFirstChild()) (cell as TableCellNode).append(paragraph);
          (paragraph as ReturnType<typeof $createParagraphNode>).append($createTextNode(`${r + 1}${c + 1}`));
        });
      });
      $getRoot().clear().append(table);
    },
    { discrete: true },
  );
}

const grid = (editor: LexicalEditor): string[][] =>
  editor.getEditorState().read(() => {
    const table = $getRoot().getFirstChild();
    if (!$isTableNode(table)) return [];
    return (table.getChildren() as TableRowNode[]).map((row) => row.getChildren().map((cell) => cell.getTextContent() || '.'));
  });

/** Selects cells from (r1,c1) to (r2,c2) as a multi-cell selection, or a caret in one cell.
 * Must run inside the same update as the action: a caret doesn't survive between
 * updates of an editor with no DOM. */
function $select(r1: number, c1: number, r2 = r1, c2 = c1): void {
  const table = $getRoot().getFirstChild() as TableNodeType;
  const cellAt = (r: number, c: number) => (table.getChildren()[r] as TableRowNode).getChildren()[c] as TableCellNode;
  if (r1 === r2 && c1 === c2) {
    cellAt(r1, c1).selectEnd();
    return;
  }
  const selection = $createTableSelection();
  selection.set(table.getKey(), cellAt(r1, c1).getKey(), cellAt(r2, c2).getKey());
  $setSelection(selection);
}

/** Selects, then runs an action, in one update. */
const act = (editor: LexicalEditor, sel: [number, number, number?, number?], action: () => void) =>
  editor.update(
    () => {
      $select(...sel);
      action();
    },
    { discrete: true },
  );

describe('tableActions', () => {
  it('reports how many rows and columns the selection spans', () => {
    const editor = makeEditor();
    withTable(editor);
    const size = (sel: [number, number, number?, number?]) => {
      let result = { rows: -1, columns: -1 };
      act(editor, sel, () => {
        result = $getTableSelectionSize();
      });
      return result;
    };
    expect(size([1, 1])).toEqual({ rows: 1, columns: 1 });
    expect(size([1, 0, 2, 2])).toEqual({ rows: 2, columns: 3 });
  });

  it('inserts a row before or after the caret row', () => {
    const editor = makeEditor();
    withTable(editor);
    act(editor, [1, 1], () => $insertTableRows(false));
    expect(grid(editor).map((r) => r[0])).toEqual(['11', '.', '21', '31', '41']);
    act(editor, [2, 1], () => $insertTableRows(true));
    expect(grid(editor).map((r) => r[0])).toEqual(['11', '.', '21', '.', '31', '41']);
  });

  it('inserts as many rows as are selected, at the selection edge', () => {
    const before = makeEditor();
    withTable(before);
    act(before, [1, 0, 2, 1], () => $insertTableRows(false));
    expect(grid(before).map((r) => r[0])).toEqual(['11', '.', '.', '21', '31', '41']);

    const after = makeEditor();
    withTable(after);
    act(after, [1, 0, 2, 1], () => $insertTableRows(true));
    expect(grid(after).map((r) => r[0])).toEqual(['11', '21', '31', '.', '.', '41']);
  });

  it('inserts a column before or after, and as many as are selected', () => {
    const one = makeEditor();
    withTable(one);
    act(one, [0, 1], () => $insertTableColumns(false));
    expect(grid(one)[0]).toEqual(['11', '.', '12', '13', '14']);

    const two = makeEditor();
    withTable(two);
    act(two, [0, 1, 1, 2], () => $insertTableColumns(true));
    expect(grid(two)[0]).toEqual(['11', '12', '13', '.', '.', '14']);
    expect(grid(two).every((row) => row.length === 6)).toBe(true);
  });

  it('works whichever way the selection was dragged', () => {
    const editor = makeEditor();
    withTable(editor);
    act(editor, [2, 2, 1, 0], () => $insertTableRows(false)); // bottom-right to top-left
    expect(grid(editor).map((r) => r[0])).toEqual(['11', '.', '.', '21', '31', '41']);
  });

  it('deletes the selected rows and columns', () => {
    const rows = makeEditor();
    withTable(rows);
    act(rows, [1, 1, 2, 2], () => $deleteTableRows());
    expect(grid(rows).map((r) => r[0])).toEqual(['11', '41']);

    const columns = makeEditor();
    withTable(columns);
    act(columns, [1, 1, 2, 2], () => $deleteTableColumns());
    expect(grid(columns)[0]).toEqual(['11', '14']);
  });

  it('deletes the whole table', () => {
    const editor = makeEditor();
    withTable(editor);
    act(editor, [1, 1], () => $deleteTable());
    expect(editor.getEditorState().read(() => $getRoot().getChildren().some($isTableNode))).toBe(false);
  });
});
