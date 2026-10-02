import { $findMatchingParent } from '@lexical/utils';
import { $createParagraphNode, $getSelection, $isParagraphNode, $isRangeSelection, type ParagraphNode } from 'lexical';
import { $createLayoutContainerNode, $createLayoutItemNode, $isLayoutContainerNode, $isLayoutItemNode } from './LayoutNode';
import { $createPoetryBlockNode, $isPoetryBlockNode, type PoetryAlign, type PoetryLayout, type PoetryBlockNode } from './PoetryNode';

/** The couplet's two misra paragraphs, in document order, regardless of
 * which layout currently holds them. */
export function $getMisraParagraphs(node: PoetryBlockNode): ParagraphNode[] {
  if (node.getLayout() === 'single') {
    return node.getChildren().filter($isParagraphNode);
  }
  const container = node.getChildren().find($isLayoutContainerNode);
  if (!container) return [];
  return container
    .getChildren()
    .filter($isLayoutItemNode)
    .map((item) => item.getFirstChild())
    .filter($isParagraphNode);
}

/** The PoetryBlockNode the current selection is inside, or null. */
export function $getPoetryBlockFromSelection(): PoetryBlockNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const match = $findMatchingParent(selection.anchor.getNode(), $isPoetryBlockNode);
  return match ?? null;
}

/**
 * Converts a couplet between single-column (two stacked misras) and
 * two-column (built on the columns primitive, §4.9) in place — pulls the
 * two misra paragraphs out of whichever shape currently holds them and
 * rebuilds the other shape around the same paragraph nodes, so content,
 * selection and undo history all survive the conversion.
 */
export function $setPoetryLayout(node: PoetryBlockNode, layout: PoetryLayout): void {
  if (node.getLayout() === layout) return;
  const misras = $getMisraParagraphs(node);
  for (const misra of misras) misra.remove();
  for (const leftover of node.getChildren()) leftover.remove();

  if (layout === 'single') {
    for (const misra of misras) node.append(misra);
  } else {
    const container = $createLayoutContainerNode('repeat(2, 1fr)');
    for (const misra of misras) container.append($createLayoutItemNode().append(misra));
    node.append(container);
  }
  node.setLayoutAttribute(layout);
}

/** Inserts a new two-misra couplet after the selection's top-level block,
 * in `layout`/`align`, and focuses its first misra. */
export function $insertPoetryCouplet(layout: PoetryLayout, align: PoetryAlign): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();

  const node = $createPoetryBlockNode(layout, align);
  const misraA = $createParagraphNode();
  const misraB = $createParagraphNode();
  if (layout === 'single') {
    node.append(misraA, misraB);
  } else {
    const container = $createLayoutContainerNode('repeat(2, 1fr)');
    container.append($createLayoutItemNode().append(misraA), $createLayoutItemNode().append(misraB));
    node.append(container);
  }

  anchorTopLevel.insertAfter(node);
  misraA.selectStart();
  return true;
}

/**
 * Enter at the end of a couplet's last misra would otherwise land inside
 * ParagraphNode's own insertNewAfter — which inserts the new paragraph as a
 * sibling of the misra, i.e. still inside the couplet (or, for two-column,
 * inside its LayoutItemNode) — trapping the caret with no way to add a line
 * after the block. Handled here instead: a plain paragraph after the whole
 * couplet, focused. Returns false (let normal Enter handling proceed) for
 * every other caret position, including earlier in the couplet.
 */
export function $exitPoetryOnEnter(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const couplet = $getPoetryBlockFromSelection();
  if (!couplet) return false;

  const misras = $getMisraParagraphs(couplet);
  const lastMisra = misras[misras.length - 1];
  if (!lastMisra) return false;

  const anchor = selection.anchor;
  const lastDesc = lastMisra.getLastDescendant();
  const isAtEnd = lastDesc ? anchor.key === lastDesc.getKey() && anchor.offset === lastDesc.getTextContentSize() : anchor.key === lastMisra.getKey();
  if (!isAtEnd) return false;

  const paragraph = $createParagraphNode();
  couplet.insertAfter(paragraph);
  paragraph.select();
  return true;
}
