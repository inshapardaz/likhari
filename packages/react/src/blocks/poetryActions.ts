import { $findMatchingParent } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  type LexicalNode,
  type ParagraphNode,
} from 'lexical';
import { $createLayoutContainerNode, $createLayoutItemNode, $isLayoutContainerNode, $isLayoutItemNode, type LayoutContainerNode } from './LayoutNode';
import {
  $createPoetryBlockNode,
  $isPoetryBlockNode,
  POETRY_CENTER_WIDTHS,
  POETRY_GUTTERS,
  POETRY_SPACINGS,
  POETRY_STAGGERS,
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
  if (node.getLayout() !== 'two-column') {
    const paragraphs = node.getChildren().filter($isParagraphNode);
    const couplets: Couplet[] = [];
    for (let i = 0; i + 1 < paragraphs.length; i += 2) couplets.push([paragraphs[i], paragraphs[i + 1]]);
    return couplets;
  }
  const containers = node.getChildren().filter($isLayoutContainerNode);
  const couplets: Couplet[] = [];
  for (const container of containers) {
    const items = container.getChildren().filter($isLayoutItemNode);
    if (items.length === 1) {
      const [a, b] = items[0].getChildren();
      if ($isParagraphNode(a) && $isParagraphNode(b)) couplets.push([a, b]);
      continue;
    }
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
  if (node.getLayout() !== 'two-column') {
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
  if (layout !== 'two-column') {
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

  // Removing a misra paragraph below (to re-append it in its new row) moves
  // the selection away the moment it's detached, even though it lands back
  // in the same paragraph a few lines later — so the caret ends up outside
  // the block entirely unless it's explicitly restored afterward.
  const selection = $getSelection();
  const anchor = $isRangeSelection(selection) ? { key: selection.anchor.key, offset: selection.anchor.offset, type: selection.anchor.type } : null;
  const focus = $isRangeSelection(selection) ? { key: selection.focus.key, offset: selection.focus.offset, type: selection.focus.type } : null;

  for (const [a, b] of couplets) {
    a.remove();
    b.remove();
  }
  for (const leftover of node.getChildren()) leftover.remove();

  if (layout !== 'two-column') {
    for (const [a, b] of couplets) node.append(a, b);
  } else {
    for (const [a, b] of couplets) {
      const container = $createLayoutContainerNode('repeat(2, 1fr)');
      container.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
      node.append(container);
    }
  }
  node.setLayoutAttribute(layout);

  if (anchor && focus) {
    const restored = $createRangeSelection();
    restored.anchor.set(anchor.key, anchor.offset, anchor.type);
    restored.focus.set(focus.key, focus.offset, focus.type);
    $setSelection(restored);
  }
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
 * misra. Otherwise creates a new block (in `layout`) with one
 * couplet, after the selection's top-level element.
 */
export function $insertPoetryCouplet(layout: PoetryLayout): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const existing = $getPoetryBlockFromSelection();
  if (existing) {
    return $insertCoupletRelativeToSelection('after');
  }

  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
  const node = $createPoetryBlockNode(layout);
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

/** Whether a point sits at the very start (or, with `atEnd`, very end) of a paragraph. */
function $isPointAt(paragraph: ParagraphNode, point: { key: string; offset: number; getNode(): LexicalNode }, atEnd: boolean): boolean {
  if (point.key === paragraph.getKey()) return point.offset === (atEnd ? paragraph.getChildrenSize() : 0);
  const edge = atEnd ? paragraph.getLastDescendant() : paragraph.getFirstDescendant();
  if (point.getNode() !== edge) return false;
  return point.offset === (atEnd ? point.getNode().getTextContent().length : 0);
}

/**
 * Backspace at the start of a misra never merges it into its neighbour: the
 * block's lines are paired into couplets, so merging one line away would
 * shift every couplet after it (and take the previous couplet's last line
 * with it). Instead, Backspace at the start of an empty couplet removes that
 * couplet, and at the start of any other line it moves the caret to the end
 * of the previous line. Other caret positions (deleting within text) fall
 * through to normal handling.
 */
export function $deletePoetryOnBackspace(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return false;

  const { coupletIndex, misraIndex } = position;
  const [a, b] = couplets[coupletIndex];
  const misra = couplets[coupletIndex][misraIndex];
  if (!$isPointAt(misra, selection.anchor, false)) return false;

  if (a.isEmpty() && b.isEmpty()) {
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
    const previousCouplet = remaining[coupletIndex - 1] ?? remaining[0];
    previousCouplet?.[1].selectEnd();
    return true;
  }

  const previousLine = misraIndex === 1 ? a : couplets[coupletIndex - 1]?.[1];
  previousLine?.selectEnd();
  return true;
}

/**
 * Forward Delete at the end of a misra never merges the next line into it, for
 * the same reason as $deletePoetryOnBackspace: the caret moves to the start of
 * the next line instead. Other caret positions fall through to normal handling.
 */
export function $deletePoetryForward(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return false;

  const { coupletIndex, misraIndex } = position;
  const misra = couplets[coupletIndex][misraIndex];
  if (!$isPointAt(misra, selection.anchor, true)) return false;

  const nextLine = misraIndex === 0 ? couplets[coupletIndex][1] : couplets[coupletIndex + 1]?.[0];
  nextLine?.selectStart();
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

/** Steps the caret's staggered couplet width one notch narrower (-1) or wider
 * (+1); clamps at either end. */
export function $adjustPoetryStagger(step: 1 | -1): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  const index = POETRY_STAGGERS.indexOf(block.getStagger());
  const next = POETRY_STAGGERS[Math.min(POETRY_STAGGERS.length - 1, Math.max(0, index + step))];
  block.setStagger(next);
  return true;
}

/** Steps the caret's centered-couplet width (issue #27) one notch narrower
 * (-1) or wider (+1); clamps at either end. */
export function $adjustPoetryCenterWidth(step: 1 | -1): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  const index = POETRY_CENTER_WIDTHS.indexOf(block.getCenterWidth());
  const next = POETRY_CENTER_WIDTHS[Math.min(POETRY_CENTER_WIDTHS.length - 1, Math.max(0, index + step))];
  block.setCenterWidth(next);
  return true;
}

/** A centered couplet is a two-column row holding both misras in one item
 * (a single-item row), rather than one item per misra. */
function $isCoupletRowCentered(row: LayoutContainerNode): boolean {
  return row.getChildren().filter($isLayoutItemNode).length === 1;
}

function $findCoupletRow(couplet: Couplet): LayoutContainerNode | null {
  return $findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null;
}

/** Whether the couplet the caret is in is centered, or null outside a
 * two-column poetry block (centering only applies there). */
export function $getCoupletCenteredFromSelection(): boolean | null {
  const block = $getPoetryBlockFromSelection();
  if (!block || block.getLayout() !== 'two-column') return null;
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return null;
  const row = $findCoupletRow(couplets[position.coupletIndex]);
  return row ? $isCoupletRowCentered(row) : false;
}

/** Centers (or un-centers) the caret's couplet within a two-column block by
 * rebuilding its row around the same two misra paragraphs. */
export function $setCoupletCentered(centered: boolean): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block || block.getLayout() !== 'two-column') return false;
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return false;
  const couplet = couplets[position.coupletIndex];
  const row = $findCoupletRow(couplet);
  if (!row || $isCoupletRowCentered(row) === centered) return true;

  const [a, b] = couplet;
  const newRow = $createLayoutContainerNode(centered ? '1fr' : 'repeat(2, 1fr)');
  if (centered) {
    newRow.append($createLayoutItemNode().append(a, b));
  } else {
    newRow.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
  }
  row.insertAfter(newRow);
  row.remove();
  a.selectStart();
  return true;
}

/** Removes the whole poetry block the caret is in, including every couplet. */
export function $deletePoetryBlock(): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  block.remove();
  return true;
}

/** Single-column blocks pair their paragraphs into couplets, so a line left
 * without a partner (from pasted or imported content) would be invisible to
 * the couplet logic. Give it an empty partner instead, so every line belongs
 * to a couplet and can be deleted like any other. */
export function $completeSingleCoupletBlock(node: PoetryBlockNode): void {
  if (node.getLayout() === 'two-column') return;
  if (node.getChildrenSize() % 2 === 1) node.append($createParagraphNode());
}
