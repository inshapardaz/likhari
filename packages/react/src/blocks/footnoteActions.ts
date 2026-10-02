import { $createParagraphNode, $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import { $createFootnoteReferenceNode } from './FootnoteNode';
import { $createFootnoteItemNode, $createFootnoteListNode, $isFootnoteItemNode, $isFootnoteListNode } from './FootnoteListNode';

let counter = 0;

/** Short, collision-resistant within a single document: a monotonic counter
 * is enough here (ids never need to be stable/meaningful across documents),
 * and avoids a hard dependency on crypto.randomUUID being available. */
function newFootnoteId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Inserts a reference at the caret and a matching empty item at the end of
 * the document's footnote list (creating the list if this is the first
 * footnote), then focuses the new item so the user can type the note. */
export function $insertFootnote(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const footnoteId = newFootnoteId();
  selection.insertNodes([$createFootnoteReferenceNode(footnoteId)]);

  const root = $getRoot();
  const lastChild = root.getLastChild();
  const list = $isFootnoteListNode(lastChild) ? lastChild : $createFootnoteListNode();
  if (!$isFootnoteListNode(lastChild)) root.append(list);

  const item = $createFootnoteItemNode(footnoteId).append($createParagraphNode());
  list.append(item);
  item.getFirstDescendant()?.selectStart();
  return true;
}

/** Removes the FootnoteItemNode for `footnoteId`, and the FootnoteListNode
 * itself if that was its last item — called by FootnotePlugin's mutation
 * listener when a FootnoteReferenceNode is deleted from the text. */
export function $removeFootnoteItem(footnoteId: string): void {
  const list = $getRoot().getChildren().find($isFootnoteListNode);
  if (!list) return;
  const item = list.getChildren().find((child) => $isFootnoteItemNode(child) && child.getFootnoteId() === footnoteId);
  item?.remove();
  if (list.getChildrenSize() === 0) list.remove();
}
