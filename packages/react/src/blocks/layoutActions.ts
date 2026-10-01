import { $getSelection, $isRangeSelection } from 'lexical';
import { $createLayoutWithColumns, $isLayoutContainerNode, $isLayoutItemNode, LayoutContainerNode, LayoutItemNode } from './LayoutNode';

/** Inserts a `columnCount`-column layout right after the selection's
 * top-level block, and focuses its first column. Returns false (so the
 * command falls through) when there's no usable selection to anchor on. */
export function $insertLayout(columnCount: number): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
  const container = $createLayoutWithColumns(columnCount);
  anchorTopLevel.insertAfter(container);
  container.getFirstDescendant()?.selectStart();
  return true;
}

/** Keeps LayoutContainerNode/LayoutItemNode nesting valid against malformed
 * trees from paste, undo or JSON import — a LayoutItemNode can only live
 * directly inside a LayoutContainerNode and vice versa. */
export function $normalizeLayoutItem(node: LayoutItemNode): void {
  const parent = node.getParent();
  if ($isLayoutContainerNode(parent)) return;
  // Orphaned: unwrap into plain content rather than leaving a stray node.
  for (const child of node.getChildren()) node.insertBefore(child);
  node.remove();
}

/** See $normalizeLayoutItem — the container-side half of the same rule. */
export function $normalizeLayoutContainer(node: LayoutContainerNode): void {
  const children = node.getChildren();
  if (children.length === 0) {
    node.remove();
    return;
  }
  for (const child of children) {
    if (!$isLayoutItemNode(child)) child.remove();
  }
}
