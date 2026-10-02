import { $findMatchingParent } from '@lexical/utils';
import { $createParagraphNode, $getSelection, $isElementNode, $isParagraphNode, $isRangeSelection, type ParagraphNode } from 'lexical';
import { $createLayoutContainerNode, $createLayoutItemNode, $isLayoutContainerNode, $isLayoutItemNode } from './LayoutNode';
import { $createPoetryCoupletNode, $isPoetryCoupletNode, type PoetryCoupletNode } from './PoetryCoupletNode';
import { $createPoetryBlockNode, $isPoetryBlockNode, type PoetryAlign, type PoetryLayout, type PoetryBlockNode } from './PoetryNode';

/** One couplet's two misra paragraphs, in order. */
export type Couplet = [ParagraphNode, ParagraphNode];

/**
 * A poetry block's children are a free mix, per couplet, of either a
 * PoetryCoupletNode (single-column/alternating, optionally `centered`) or a
 * LayoutContainerNode row (two-column) — "two columns with a couplet that
 * is single, aligned centered" means exactly this: some couplets two-column,
 * others centered singles, in the same block. This walks that mixed
 * structure and returns each couplet as a misra pair, in document order —
 * the one place that knows how to read either wrapper, so nothing else does.
 */
export function $getCouplets(node: PoetryBlockNode): Couplet[] {
  const couplets: Couplet[] = [];
  for (const child of node.getChildren()) {
    if ($isPoetryCoupletNode(child)) {
      const [a, b] = child.getChildren().filter($isParagraphNode);
      if (a && b) couplets.push([a, b]);
    } else if ($isLayoutContainerNode(child)) {
      const items = child.getChildren().filter($isLayoutItemNode);
      const a = items[0]?.getFirstChild();
      const b = items[1]?.getFirstChild();
      if ($isParagraphNode(a) && $isParagraphNode(b)) couplets.push([a, b]);
    }
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

/** A couplet's own wrapper node (PoetryCoupletNode or LayoutContainerNode) —
 * every couplet has exactly one, so removing/replacing a couplet means
 * operating on this, not on its misra paragraphs individually. */
function $findCoupletWrapper(misra: ParagraphNode): PoetryCoupletNode | import('./LayoutNode').LayoutContainerNode | null {
  return $findMatchingParent(misra, (n) => $isPoetryCoupletNode(n) || $isLayoutContainerNode(n)) as
    | PoetryCoupletNode
    | import('./LayoutNode').LayoutContainerNode
    | null;
}

/** Appends a new couplet to the block, in its default layout (two-column
 * for a 'two-column' block, a plain PoetryCoupletNode otherwise) unless
 * `twoColumn` is given explicitly. */
function $appendCoupletTo(node: PoetryBlockNode, twoColumn?: boolean): Couplet {
  const misraA = $createParagraphNode();
  const misraB = $createParagraphNode();
  const useTwoColumn = twoColumn ?? node.getLayout() === 'two-column';
  if (useTwoColumn) {
    const container = $createLayoutContainerNode('repeat(2, 1fr)');
    container.append($createLayoutItemNode().append(misraA), $createLayoutItemNode().append(misraB));
    node.append(container);
  } else {
    node.append($createPoetryCoupletNode().append(misraA, misraB));
  }
  return [misraA, misraB];
}

/**
 * Converts every couplet in the block between two-column (built on the
 * columns primitive, §4.9) and single-column/alternating (a
 * PoetryCoupletNode per couplet) — pulls each couplet's two misra
 * paragraphs out of whichever shape currently holds them and rebuilds the
 * other shape around the same paragraph nodes, preserving couplet order
 * (and dropping any individual 'centered' override, which only applies to
 * the non-two-column shape), so content, selection and undo history all
 * survive the conversion. Switching between 'single' and 'alternating' is
 * purely an attribute change (both use the same PoetryCoupletNode
 * structure) — no restructuring needed.
 */
export function $setPoetryLayout(node: PoetryBlockNode, layout: PoetryLayout): void {
  const from = node.getLayout();
  if (from === layout) return;

  const fromTwoColumn = from === 'two-column';
  const toTwoColumn = layout === 'two-column';
  if (fromTwoColumn === toTwoColumn) {
    // Both 'single' and 'alternating' share the same PoetryCoupletNode
    // structure — just relabel the block.
    node.setLayoutAttribute(layout);
    return;
  }

  const couplets = $getCouplets(node);
  for (const [a, b] of couplets) {
    a.remove();
    b.remove();
  }
  for (const leftover of node.getChildren()) leftover.remove();

  for (const [a, b] of couplets) {
    if (toTwoColumn) {
      const container = $createLayoutContainerNode('repeat(2, 1fr)');
      container.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
      node.append(container);
    } else {
      node.append($createPoetryCoupletNode().append(a, b));
    }
  }
  node.setLayoutAttribute(layout);
}

/**
 * Sets whether the couplet the selection is inside renders as a narrower,
 * centered box ("single, aligned centered") instead of the block's default
 * width — independent of the block's own layout. A two-column couplet is
 * converted into a PoetryCoupletNode first (its two columns stacked into
 * two lines), since "centered" only applies to that shape; a couplet
 * that's already a PoetryCoupletNode just has its flag flipped. Returns
 * false when the selection isn't inside a couplet.
 */
export function $setCoupletCentered(centered: boolean): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;

  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return false;

  const [a, b] = couplets[position.coupletIndex];
  const wrapper = $findCoupletWrapper(a);
  if (!wrapper) return false;

  if ($isPoetryCoupletNode(wrapper)) {
    wrapper.setCentered(centered);
    return true;
  }

  // A two-column couplet: stack its two columns into a centered pair,
  // replacing the LayoutContainerNode row with a PoetryCoupletNode in the
  // same position.
  a.remove();
  b.remove();
  const coupletNode = $createPoetryCoupletNode(centered).append(a, b);
  wrapper.insertAfter(coupletNode);
  wrapper.remove();
  return true;
}

/** Whether the couplet the selection is inside is currently centered —
 * always false for a two-column couplet, since that override only applies
 * to the PoetryCoupletNode shape. Null when the selection isn't inside a
 * couplet at all (vs. inside one that just isn't centered). */
export function $getCoupletCenteredFromSelection(): boolean | null {
  const block = $getPoetryBlockFromSelection();
  if (!block) return null;

  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return null;

  const wrapper = $findCoupletWrapper(couplets[position.coupletIndex][0]);
  return $isPoetryCoupletNode(wrapper) ? wrapper.getCentered() : false;
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
 * poetry block, appends a new couplet to *that* block (in its existing
 * default layout) and focuses its first misra. Otherwise creates a new
 * block (in `layout`/`align`) with one couplet, after the selection's
 * top-level element.
 */
export function $insertPoetryCouplet(layout: PoetryLayout, align: PoetryAlign): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const existing = $getPoetryBlockFromSelection();
  if (existing) {
    const [misraA] = $appendCoupletTo(existing);
    misraA.selectStart();
    return true;
  }

  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
  const node = $createPoetryBlockNode(layout, align);
  const [misraA] = $appendCoupletTo(node, layout === 'two-column');

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

  $findCoupletWrapper(target[0])?.remove();
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

  const [a, b] = couplets[position.coupletIndex];
  const anchor = selection.anchor;
  const isAtStart = anchor.key === a.getKey() && anchor.offset === 0;
  if (!isAtStart) return false;
  if (!a.isEmpty() || !b.isEmpty()) return false;

  if (couplets.length <= 1) {
    const previous = block.getPreviousSibling();
    block.remove();
    if ($isElementNode(previous)) previous.selectEnd();
    return true;
  }

  $findCoupletWrapper(a)?.remove();
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
    if (couplets.length > 1) $findCoupletWrapper(a)?.remove();
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
