import { $findMatchingParent } from '@lexical/utils';
import { $createParagraphNode, $getSelection, $isElementNode, $isParagraphNode, $isRangeSelection, type ParagraphNode } from 'lexical';
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

/** A couplet at the very end of the document would otherwise leave no
 * editable block to click or arrow down into — appends one empty paragraph
 * if the couplet doesn't already have a next sibling. Idempotent: once a
 * sibling exists (that paragraph, or anything else), this is a no-op, so
 * it's safe to call from both the insert command and a node transform that
 * keeps the invariant even after later edits (e.g. deleting the trailing
 * paragraph, or JSON content loaded without one). */
export function $ensureTrailingParagraph(node: PoetryBlockNode): void {
  if (node.getNextSibling() === null) node.insertAfter($createParagraphNode());
}

/** Inserts a new two-misra couplet after the selection's top-level block,
 * in `layout`/`align`, and focuses its first misra. */
export function $insertPoetryCouplet(layout: PoetryLayout, align: PoetryAlign): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  // getTopLevelElement() stops at the nearest shadow root, and a
  // PoetryBlockNode is one — so from inside an existing couplet it resolves
  // to the misra paragraph itself, not the couplet. Without this check, a
  // second insert lands as a sibling of that misra (nested inside the first
  // couplet) instead of after the couplet as a whole.
  const anchorTopLevel = $getPoetryBlockFromSelection() ?? selection.anchor.getNode().getTopLevelElementOrThrow();

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
  $ensureTrailingParagraph(node);
  misraA.selectStart();
  return true;
}

/** Removes the whole couplet the selection is inside, if any — the explicit,
 * always-available counterpart to $deletePoetryOnBackspace's empty-couplet
 * shortcut (mirrors the table menu's own "Delete table" action). */
export function $deletePoetryCouplet(): boolean {
  const couplet = $getPoetryBlockFromSelection();
  if (!couplet) return false;
  couplet.remove();
  return true;
}

/**
 * Backspace at the very start of an empty couplet's first misra removes the
 * whole block — the natural keystroke to try first, and otherwise there was
 * no way to get rid of an empty couplet created by mistake (its two misra
 * paragraphs each have their own default canBeEmpty, so Lexical's usual
 * "delete the empty block" handling never reaches the couplet itself).
 * Returns false for every other caret position, including a non-empty
 * couplet, so normal Backspace handling (e.g. deleting within text) proceeds.
 */
export function $deletePoetryOnBackspace(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const couplet = $getPoetryBlockFromSelection();
  if (!couplet) return false;

  const misras = $getMisraParagraphs(couplet);
  const firstMisra = misras[0];
  if (!firstMisra) return false;
  if (misras.some((m) => !m.isEmpty())) return false;

  const anchor = selection.anchor;
  const isAtStart = anchor.key === firstMisra.getKey() && anchor.offset === 0;
  if (!isAtStart) return false;

  const previous = couplet.getPreviousSibling();
  couplet.remove();
  if ($isElementNode(previous)) previous.selectEnd();
  return true;
}

/**
 * A couplet is always exactly two misras — Enter must never grow it past
 * that. Pressed anywhere in the first misra, Enter moves the caret to the
 * second (the line already exists; nothing is inserted). Pressed anywhere
 * in the second (the last), Enter exits: ParagraphNode's own
 * insertNewAfter would otherwise insert the new paragraph as a sibling of
 * the misra — i.e. still inside the couplet, growing it to three lines
 * and, on the next Enter, four, and so on — so that's handled here
 * instead, reusing or creating a plain paragraph after the whole couplet.
 * Intercepts Enter at *any* caret position inside the couplet (not just
 * at an edge) specifically to prevent that growth; returns false only
 * when the selection isn't inside a couplet at all.
 */
export function $exitPoetryOnEnter(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const couplet = $getPoetryBlockFromSelection();
  if (!couplet) return false;

  const misras = $getMisraParagraphs(couplet);
  const anchorNode = selection.anchor.getNode();
  const misraIndex = misras.findIndex((m) => m.getKey() === anchorNode.getKey() || m.isParentOf(anchorNode));

  if (misraIndex !== -1 && misraIndex < misras.length - 1) {
    misras[misraIndex + 1].selectEnd();
    return true;
  }

  // On the last misra (or misraIndex === -1, e.g. the caret landed on the
  // couplet's shadow-root boundary itself) — exit. $ensureTrailingParagraph
  // already guarantees a paragraph after every couplet; reuse it rather
  // than stacking a new empty one on repeated Enters.
  const existing = couplet.getNextSibling();
  const paragraph = $isParagraphNode(existing) ? existing : $createParagraphNode();
  if (paragraph !== existing) couplet.insertAfter(paragraph);
  paragraph.select();
  return true;
}
