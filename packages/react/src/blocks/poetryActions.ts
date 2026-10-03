import { $findMatchingParent } from '@lexical/utils';
import { $createParagraphNode, $getSelection, $isElementNode, $isParagraphNode, $isRangeSelection, type ParagraphNode } from 'lexical';
import { $createLayoutContainerNode, $createLayoutItemNode, $isLayoutContainerNode, $isLayoutItemNode, type LayoutContainerNode } from './LayoutNode';
import {
  $createPoetryBlockNode,
  $isPoetryBlockNode,
  POETRY_GUTTERS,
  POETRY_SPACINGS,
  type PoetryAlign,
  type PoetryBlockNode,
  type PoetryLayout,
} from './PoetryNode';

/** One couplet's two misra paragraphs, in order. */
export type Couplet = [ParagraphNode, ParagraphNode];

/**
 * A poetry block is a *section* of one or more couplets sharing one layout
 * (single-column stacks each couplet's two misras directly as paragraph
 * children, two deep per couplet; two-column gives each couplet its own
 * LayoutContainerNode row). This walks that structure and returns each
 * couplet as a pair, in document order — the one place that knows how to
 * read either shape, so nothing else needs to.
 */
export function $getCouplets(node: PoetryBlockNode): Couplet[] {
  if (node.getLayout() === 'single') {
    const paragraphs = node.getChildren().filter($isParagraphNode);
    const couplets: Couplet[] = [];
    for (let i = 0; i + 1 < paragraphs.length; i += 2) couplets.push([paragraphs[i], paragraphs[i + 1]]);
    return couplets;
  }
  const containers = node.getChildren().filter($isLayoutContainerNode);
  const couplets: Couplet[] = [];
  for (const container of containers) {
    const items = container.getChildren().filter($isLayoutItemNode);
    const a = items[0]?.getFirstChild();
    const b = items[1]?.getFirstChild();
    if ($isParagraphNode(a) && $isParagraphNode(b)) couplets.push([a, b]);
  }
  return couplets;
}

/** Every misra in the block, flattened across all its couplets — for
 * operations (like $setPoetryLayout) that don't care about couplet
 * boundaries, just the full set of lines. */
export function $getMisraParagraphs(node: PoetryBlockNode): ParagraphNode[] {
  return $getCouplets(node).flat();
}

/** The PoetryBlockNode the current selection is inside, or null. */
export function $getPoetryBlockFromSelection(): PoetryBlockNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const match = $findMatchingParent(selection.anchor.getNode(), $isPoetryBlockNode);
  return match ?? null;
}

/** Which couplet (and which of its two misras, 0 or 1) a node sits inside,
 * or null if it's in neither — e.g. on the block's own boundary. */
function $findCoupletPosition(couplets: Couplet[], target: import('lexical').LexicalNode): { coupletIndex: number; misraIndex: 0 | 1 } | null {
  for (let c = 0; c < couplets.length; c++) {
    for (const misraIndex of [0, 1] as const) {
      const misra = couplets[c][misraIndex];
      if (misra.getKey() === target.getKey() || misra.isParentOf(target)) return { coupletIndex: c, misraIndex };
    }
  }
  return null;
}

function $appendCoupletTo(node: PoetryBlockNode): Couplet {
  const misraA = $createParagraphNode();
  const misraB = $createParagraphNode();
  if (node.getLayout() === 'single') {
    node.append(misraA, misraB);
  } else {
    const container = $createLayoutContainerNode('repeat(2, 1fr)');
    container.append($createLayoutItemNode().append(misraA), $createLayoutItemNode().append(misraB));
    node.append(container);
  }
  return [misraA, misraB];
}

/**
 * Inserts a new, empty couplet immediately before or after an existing one —
 * the table-row-insert equivalent for a poetry block ("add/remove couplets
 * just like adding/removing table rows"). `existingFirstMisra` is that
 * couplet's first misra, used to locate its wrapper (nothing, in single
 * layout — just its two sibling paragraphs; a LayoutContainerNode row in
 * two-column) so the new couplet can be spliced in at the right spot
 * regardless of layout.
 */
function $insertCoupletRelativeTo(existingFirstMisra: ParagraphNode, layout: PoetryLayout, position: 'before' | 'after'): Couplet {
  const misraA = $createParagraphNode();
  const misraB = $createParagraphNode();
  if (layout === 'single') {
    if (position === 'before') {
      existingFirstMisra.insertBefore(misraA);
      misraA.insertAfter(misraB);
    } else {
      const existingSecondMisra = existingFirstMisra.getNextSibling() ?? existingFirstMisra;
      existingSecondMisra.insertAfter(misraA);
      misraA.insertAfter(misraB);
    }
  } else {
    const container = $findMatchingParent(existingFirstMisra, $isLayoutContainerNode) as LayoutContainerNode;
    const newContainer = $createLayoutContainerNode('repeat(2, 1fr)');
    newContainer.append($createLayoutItemNode().append(misraA), $createLayoutItemNode().append(misraB));
    if (position === 'before') container.insertBefore(newContainer);
    else container.insertAfter(newContainer);
  }
  return [misraA, misraB];
}

/**
 * The explicit "Insert couplet above/below" menu actions — mirrors the
 * table menu's "Insert row before/after". Targets the couplet the caret is
 * currently in, falling back to the block's last couplet (so the toolbar's
 * always-available insert button has somewhere sensible to act on even
 * without a precise caret position).
 */
export function $insertCoupletRelativeToSelection(position: 'before' | 'after'): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const selection = $getSelection();
  const couplets = $getCouplets(block);
  const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
  const found = anchorNode ? $findCoupletPosition(couplets, anchorNode) : null;
  const index = found ? found.coupletIndex : couplets.length - 1;
  const target = couplets[index];
  if (!target) return false;

  const [newA] = $insertCoupletRelativeTo(target[0], block.getLayout(), position);
  newA.selectStart();
  return true;
}

/**
 * Converts every couplet in the block between single-column (two stacked
 * misras) and two-column (built on the columns primitive, §4.9) in place —
 * pulls each couplet's two misra paragraphs out of whichever shape
 * currently holds them and rebuilds the other shape around the same
 * paragraph nodes, preserving couplet order, so content, selection and
 * undo history all survive the conversion.
 */
export function $setPoetryLayout(node: PoetryBlockNode, layout: PoetryLayout): void {
  if (node.getLayout() === layout) return;
  const couplets = $getCouplets(node);
  for (const [a, b] of couplets) {
    a.remove();
    b.remove();
  }
  for (const leftover of node.getChildren()) leftover.remove();

  if (layout === 'single') {
    for (const [a, b] of couplets) node.append(a, b);
  } else {
    for (const [a, b] of couplets) {
      const container = $createLayoutContainerNode('repeat(2, 1fr)');
      container.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
      node.append(container);
    }
  }
  node.setLayoutAttribute(layout);
}

/** A block at the very end of the document would otherwise leave no
 * editable block to click or arrow down into — appends one empty paragraph
 * if the block doesn't already have a next sibling. Idempotent: once a
 * sibling exists (that paragraph, or anything else), this is a no-op, so
 * it's safe to call from both the insert command and a node transform that
 * keeps the invariant even after later edits (e.g. deleting the trailing
 * paragraph, or JSON content loaded without one). */
export function $ensureTrailingParagraph(node: PoetryBlockNode): void {
  if (node.getNextSibling() === null) node.insertAfter($createParagraphNode());
}

/**
 * Inserts a poetry couplet at the caret. If the caret is already inside a
 * poetry block, inserts a new couplet right after the one the caret is in
 * (same as the "Insert couplet below" menu action — table-row-insert
 * semantics, in its existing layout: "one poetry block can contain one or
 * more couplets, in one or two column layout", so a block's layout is
 * fixed once it has couplets, not chosen per couplet) and focuses its first
 * misra. Otherwise creates a new block (in `layout`/`align`) with one
 * couplet, after the selection's top-level element.
 */
export function $insertPoetryCouplet(layout: PoetryLayout, align: PoetryAlign): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const existing = $getPoetryBlockFromSelection();
  if (existing) {
    return $insertCoupletRelativeToSelection('after');
  }

  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
  const node = $createPoetryBlockNode(layout, align);
  const [misraA] = $appendCoupletTo(node);

  anchorTopLevel.insertAfter(node);
  $ensureTrailingParagraph(node);
  misraA.selectStart();
  return true;
}

/** Removes the couplet the selection is inside. If it's the block's only
 * couplet, removes the whole block (an empty poetry section serves no
 * purpose) — the explicit, always-available counterpart to
 * $deletePoetryOnBackspace's empty-couplet shortcut (mirrors the table
 * menu's own "Delete table" action). */
export function $deletePoetryCouplet(): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const selection = $getSelection();
  const couplets = $getCouplets(block);
  const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
  const position = anchorNode ? $findCoupletPosition(couplets, anchorNode) : null;
  const target = position ? couplets[position.coupletIndex] : couplets[couplets.length - 1];
  if (!target) return false;

  if (couplets.length <= 1) {
    block.remove();
    return true;
  }

  const [a, b] = target;
  const container = $findMatchingParent(a, $isLayoutContainerNode) as LayoutContainerNode | null;
  if (container) container.remove();
  else {
    a.remove();
    b.remove();
  }
  return true;
}

/**
 * Backspace at the very start of an empty couplet removes just that
 * couplet — merging back into the previous one's end, or (if it's the
 * block's only couplet) removing the whole block, since an empty poetry
 * section serves no purpose. Otherwise there was no way to get rid of an
 * empty couplet created by mistake (its misra paragraphs each have their
 * own default canBeEmpty, so Lexical's usual "delete the empty block"
 * handling never reaches the couplet itself). Returns false for every
 * other caret position, including a non-empty couplet, so normal Backspace
 * handling (e.g. deleting within text) proceeds.
 */
export function $deletePoetryOnBackspace(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const couplets = $getCouplets(block);
  const anchorNode = selection.anchor.getNode();
  const position = $findCoupletPosition(couplets, anchorNode);
  if (!position || position.misraIndex !== 0) return false;

  const [firstMisra] = couplets[position.coupletIndex];
  const anchor = selection.anchor;
  const isAtStart = anchor.key === firstMisra.getKey() && anchor.offset === 0;
  if (!isAtStart) return false;

  const [a, b] = couplets[position.coupletIndex];
  if (!a.isEmpty() || !b.isEmpty()) return false;

  if (couplets.length <= 1) {
    const previous = block.getPreviousSibling();
    block.remove();
    if ($isElementNode(previous)) previous.selectEnd();
    return true;
  }

  const container = $findMatchingParent(a, $isLayoutContainerNode) as LayoutContainerNode | null;
  if (container) container.remove();
  else {
    a.remove();
    b.remove();
  }
  const remaining = $getCouplets(block);
  const previousCouplet = remaining[position.coupletIndex - 1] ?? remaining[0];
  previousCouplet?.[1].selectEnd();
  return true;
}

/**
 * Enter inside a poetry block never grows a couplet past its fixed two
 * misras. The block's *last* couplet being completely empty is always the
 * exit trigger, regardless of which of its two (both-empty) misras the
 * caret happens to be on — pressing Enter once on a non-empty last couplet
 * appends a fresh empty one to continue into ("new couplet after last"),
 * and pressing Enter again on that still-untouched couplet exits ("double
 * enter to exit the block"): the same empty-item convention most editors
 * use for lists. Outside that case: pressed in a couplet's first misra,
 * Enter moves the caret to the second (already there; nothing inserted —
 * this is what stops ParagraphNode's default insertNewAfter from growing
 * the couplet, which would otherwise insert the new paragraph as a sibling
 * of wherever the caret was, i.e. still inside the couplet); pressed in
 * the last misra of a couplet that isn't the block's last, it moves to the
 * next couplet's first misra.
 */
export function $exitPoetryOnEnter(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return false;

  const { coupletIndex, misraIndex } = position;
  const [a, b] = couplets[coupletIndex];
  const isLastCouplet = coupletIndex === couplets.length - 1;
  const coupletEmpty = a.isEmpty() && b.isEmpty();

  if (isLastCouplet && coupletEmpty) {
    // Drop the couplet we ourselves auto-created on the previous Enter —
    // unless it's the block's only couplet, in which case leave the
    // section as the user's (empty) content rather than deleting it.
    if (couplets.length > 1) {
      const container = $findMatchingParent(a, $isLayoutContainerNode) as LayoutContainerNode | null;
      if (container) container.remove();
      else {
        a.remove();
        b.remove();
      }
    }
    const existingNext = block.getNextSibling();
    const paragraph = $isParagraphNode(existingNext) ? existingNext : $createParagraphNode();
    if (paragraph !== existingNext) block.insertAfter(paragraph);
    paragraph.select();
    return true;
  }

  if (misraIndex === 0) {
    b.selectEnd();
    return true;
  }

  if (!isLastCouplet) {
    couplets[coupletIndex + 1][0].selectEnd();
    return true;
  }

  const [newA] = $appendCoupletTo(block);
  newA.selectStart();
  return true;
}

/** Steps the caret's poetry block one notch looser (+1) or tighter (-1) on
 * the couplet-spacing scale; clamps at either end. */
export function $adjustPoetrySpacing(step: 1 | -1): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  const index = POETRY_SPACINGS.indexOf(block.getSpacing());
  const next = POETRY_SPACINGS[Math.min(POETRY_SPACINGS.length - 1, Math.max(0, index + step))];
  block.setSpacing(next);
  return true;
}

/** Steps the caret's two-column gutter one notch wider (+1) or narrower (-1);
 * clamps at either end. */
export function $adjustPoetryGutter(step: 1 | -1): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  const index = POETRY_GUTTERS.indexOf(block.getGutter());
  const next = POETRY_GUTTERS[Math.min(POETRY_GUTTERS.length - 1, Math.max(0, index + step))];
  block.setGutter(next);
  return true;
}
