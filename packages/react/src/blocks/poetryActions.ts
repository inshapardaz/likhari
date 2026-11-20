import { $findMatchingParent } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalNode,
  type ParagraphNode,
} from 'lexical';
import { $createLayoutContainerNode, $createLayoutItemNode, $isLayoutContainerNode, $isLayoutItemNode, type LayoutContainerNode } from './LayoutNode';
import {
  $createPoetryBlockNode,
  $isPoetryBlockNode,
  DEFAULT_POETRY_FORM,
  POETRY_CENTER_WIDTHS,
  POETRY_GUTTERS,
  POETRY_SPACINGS,
  POETRY_STAGGERS,
  POETRY_STANZA_SIZE,
  type PoetryBlockNode,
  type PoetryForm,
  type PoetryLayout,
  type PoetryStaggerGroup,
} from './PoetryNode';

/** One stanza's misra paragraphs, in order — two for a couplet, five for a
 * mukhammas, six for a musaddas (POETRY_STANZA_SIZE). The name/type predate
 * the musaddas/mukhammas generalization (lexical-editor-spec.md §4.11,
 * amended) and are kept for call-site stability; every function below reads
 * its length rather than assuming 2. */
export type Couplet = ParagraphNode[];

/**
 * A poetry block is a *section* of one or more stanzas sharing one layout
 * and form (single-column stacks each stanza's misras directly as paragraph
 * children, `POETRY_STANZA_SIZE[form]` deep per stanza; two-column — couplet
 * form only — gives each couplet its own LayoutContainerNode row). This
 * walks that structure and returns each stanza as an array, in document
 * order — the one place that knows how to read either shape, so nothing
 * else needs to.
 */
export function $getCouplets(node: PoetryBlockNode): Couplet[] {
  if (node.getLayout() !== 'two-column') {
    const size = POETRY_STANZA_SIZE[node.getForm()];
    const paragraphs = node.getChildren().filter($isParagraphNode);
    const couplets: Couplet[] = [];
    for (let i = 0; i + size - 1 < paragraphs.length; i += size) couplets.push(paragraphs.slice(i, i + size));
    return couplets;
  }
  // two-column is couplet-form only (PoetryNode.tsx), always two misras per row.
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

/** Every misra in the block, flattened across all its stanzas — for
 * operations (like $setPoetryLayout) that don't care about stanza
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

/** Which stanza (and which misra index within it) a node sits inside, or
 * null if it's in neither — e.g. on the block's own boundary. */
function $findCoupletPosition(couplets: Couplet[], target: import('lexical').LexicalNode): { coupletIndex: number; misraIndex: number } | null {
  for (let c = 0; c < couplets.length; c++) {
    for (let misraIndex = 0; misraIndex < couplets[c].length; misraIndex++) {
      const misra = couplets[c][misraIndex];
      if (misra.getKey() === target.getKey() || misra.isParentOf(target)) return { coupletIndex: c, misraIndex };
    }
  }
  return null;
}

/** The stanza the caret is in (its misra paragraphs), or null when the
 * selection is outside a poetry block or on a block boundary — what the
 * hover inserter (PoetryCoupletInserter.tsx) measures to place its
 * above/below affordances. */
export function $getCoupletFromSelection(): Couplet | null {
  const block = $getPoetryBlockFromSelection();
  if (!block) return null;
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  return position ? couplets[position.coupletIndex] : null;
}

/** Removes a stanza's nodes from the tree: its single two-column row
 * (couplet form only), or every one of its misra paragraphs otherwise. */
function $removeCoupletNodes(couplet: Couplet, layout: PoetryLayout): void {
  const container = layout === 'two-column' ? ($findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null) : null;
  if (container) container.remove();
  else for (const misra of couplet) misra.remove();
}

function $appendCoupletTo(node: PoetryBlockNode): Couplet {
  const size = POETRY_STANZA_SIZE[node.getForm()];
  const misras = Array.from({ length: size }, () => $createParagraphNode());
  if (node.getLayout() !== 'two-column') {
    node.append(...misras);
  } else {
    const container = $createLayoutContainerNode('repeat(2, 1fr)');
    container.append($createLayoutItemNode().append(misras[0]), $createLayoutItemNode().append(misras[1]));
    node.append(container);
  }
  return misras;
}

/**
 * Inserts a new, empty stanza immediately before or after an existing one —
 * the table-row-insert equivalent for a poetry block ("add/remove couplets
 * just like adding/removing table rows"). `existingStanza` is the whole
 * stanza to insert next to, so its first/last misra (and, in two-column
 * layout, its row wrapper) can be located regardless of form or layout.
 */
function $insertCoupletRelativeTo(existingStanza: Couplet, block: PoetryBlockNode, position: 'before' | 'after'): Couplet {
  const layout = block.getLayout();
  const size = POETRY_STANZA_SIZE[block.getForm()];
  const misras = Array.from({ length: size }, () => $createParagraphNode());
  if (layout !== 'two-column') {
    if (position === 'before') {
      existingStanza[0].insertBefore(misras[0]);
    } else {
      existingStanza[existingStanza.length - 1].insertAfter(misras[0]);
    }
    let previous = misras[0];
    for (let i = 1; i < misras.length; i++) {
      previous.insertAfter(misras[i]);
      previous = misras[i];
    }
  } else {
    const container = $findMatchingParent(existingStanza[0], $isLayoutContainerNode) as LayoutContainerNode;
    const newContainer = $createLayoutContainerNode('repeat(2, 1fr)');
    newContainer.append($createLayoutItemNode().append(misras[0]), $createLayoutItemNode().append(misras[1]));
    if (position === 'before') container.insertBefore(newContainer);
    else container.insertAfter(newContainer);
  }
  return misras;
}

/**
 * The explicit "Insert couplet above/below" menu actions — mirrors the
 * table menu's own "Insert row before/after". Targets the stanza the caret
 * is currently in, falling back to the block's last stanza (so the
 * toolbar's always-available insert button has somewhere sensible to act on
 * even without a precise caret position).
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

  const newStanza = $insertCoupletRelativeTo(target, block, position);
  newStanza[0].selectStart();
  return true;
}

/**
 * Converts every stanza in the block between single-column (stacked misras)
 * and two-column (built on the columns primitive, §4.9) in place — pulls
 * each couplet's two misra paragraphs out of whichever shape currently
 * holds them and rebuilds the other shape around the same paragraph nodes,
 * preserving stanza order, so content, selection and undo history all
 * survive the conversion. `two-column` and `staggered` are couplet-form
 * only (lexical-editor-spec.md §4.11, amended): switching into either while
 * `form !== 'couplet'` is a no-op, same as switching into a layout the
 * block is already in. Switching *out of* `single` also clears autoWidth
 * (a percentage/fit-content width is only well-defined in a single-column
 * flow).
 */
export function $setPoetryLayout(node: PoetryBlockNode, layout: PoetryLayout): void {
  if (node.getLayout() === layout) return;
  if (layout !== 'single' && node.getForm() !== 'couplet') return;

  const couplets = $getCouplets(node);

  // Removing a misra paragraph below (to re-append it in its new row) moves
  // the selection away the moment it's detached, even though it lands back
  // in the same paragraph a few lines later — so the caret ends up outside
  // the block entirely unless it's explicitly restored afterward.
  const selection = $getSelection();
  const anchor = $isRangeSelection(selection) ? { key: selection.anchor.key, offset: selection.anchor.offset, type: selection.anchor.type } : null;
  const focus = $isRangeSelection(selection) ? { key: selection.focus.key, offset: selection.focus.offset, type: selection.focus.type } : null;

  for (const couplet of couplets) {
    for (const misra of couplet) misra.remove();
  }
  for (const leftover of node.getChildren()) leftover.remove();

  if (layout !== 'two-column') {
    for (const couplet of couplets) node.append(...couplet);
  } else {
    for (const [a, b] of couplets) {
      const container = $createLayoutContainerNode('repeat(2, 1fr)');
      container.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
      node.append(container);
    }
  }
  node.setLayoutAttribute(layout);
  if (layout !== 'single' && node.getAutoWidth()) node.setAutoWidth(false);

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

/** Whether every child of `element` is inline content (text, line breaks,
 * links…) that can be moved straight into a misra paragraph. Blocks whose
 * children are themselves blocks (lists, tables, columns, poetry) can't be,
 * so they fall back to their plain text. */
function $hasOnlyInlineChildren(element: ElementNode): boolean {
  return element.getChildren().every((child) => !$isElementNode(child) || child.isInline());
}

/** Strips leading (or, with `atEnd`, trailing) whitespace off a run of
 * inline nodes in place, dropping any text node left empty by it, and
 * returns the nodes that remain. Stops at the first node that isn't plain
 * text (a link, say), since its own text is content, not padding. */
function trimRun(run: LexicalNode[], atEnd: boolean): LexicalNode[] {
  const nodes = atEnd ? [...run].reverse() : [...run];
  while (nodes.length > 0) {
    const node = nodes[0];
    if (!$isTextNode(node)) break;
    const text = node.getTextContent();
    const trimmed = atEnd ? text.replace(/\s+$/u, '') : text.replace(/^\s+/u, '');
    if (trimmed.length === 0) {
      nodes.shift();
      continue;
    }
    if (trimmed !== text) node.setTextContent(trimmed);
    break;
  }
  return atEnd ? nodes.reverse() : nodes;
}

/**
 * Splits one top-level block into the lines it will contribute to a poetry
 * block: one per hard line break (Shift+Enter) for paragraph-like blocks —
 * keeping each line's inline formatting, since the nodes themselves are
 * moved rather than re-created — or one per text line for anything whose
 * children are blocks (a list, a table…). Every line is trimmed and blank
 * lines are dropped ("trim lines and remove empty lines before conversion").
 */
function $blockToPoetryLines(block: ElementNode): LexicalNode[][] {
  const runs: LexicalNode[][] = [];
  if ($hasOnlyInlineChildren(block)) {
    let current: LexicalNode[] = [];
    for (const child of block.getChildren()) {
      if ($isLineBreakNode(child)) {
        runs.push(current);
        current = [];
      } else {
        current.push(child);
      }
    }
    runs.push(current);
  } else {
    for (const line of block.getTextContent().split('\n')) runs.push([$createTextNode(line)]);
  }
  return runs
    .map((run) => trimRun(trimRun(run, false), true))
    .filter((run) => run.length > 0 && run.some((node) => node.getTextContent().trim().length > 0));
}

/**
 * Turns the blocks the selection spans into one single-column poetry block
 * ("select multiple lines and press the poetry command"): each selected
 * block's lines (see $blockToPoetryLines) become consecutive misras,
 * grouped `POETRY_STANZA_SIZE[form]` to a stanza in order, padding the
 * final stanza out with empty lines if it falls short. The new block takes
 * the place of the first selected block and the rest are removed. Returns
 * false, changing nothing, when the selection is collapsed, already inside
 * a poetry block, or holds no non-blank text.
 */
export function $convertSelectionToPoetry(form: PoetryForm = DEFAULT_POETRY_FORM): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
  if ($getPoetryBlockFromSelection()) return false;

  const blocks: ElementNode[] = [];
  const seen = new Set<string>();
  for (const node of selection.getNodes()) {
    const top = node.getTopLevelElement();
    if (!top || seen.has(top.getKey())) continue;
    seen.add(top.getKey());
    if ($isElementNode(top)) blocks.push(top);
  }
  if (blocks.length === 0) return false;

  const lines = blocks.flatMap($blockToPoetryLines);
  if (lines.length === 0) return false;

  const node = $createPoetryBlockNode('single', undefined, undefined, undefined, undefined, undefined, form);
  for (const line of lines) node.append($createParagraphNode().append(...line));
  $completeSingleCoupletBlock(node);

  blocks[0].insertBefore(node);
  for (const block of blocks) block.remove();
  $ensureTrailingParagraph(node);
  (node.getFirstChild() as ParagraphNode).selectStart();
  return true;
}

/**
 * Inserts a poetry stanza at the caret. With text selected outside a poetry
 * block, converts the selected lines into a single-column block instead
 * (see $convertSelectionToPoetry) — `form` picks the stanza size (couplet,
 * mukhammas, musaddas) for that conversion. If the caret is already inside
 * a poetry block, inserts a new stanza right after the one the caret is in
 * (same as the "Insert couplet below" menu action — table-row-insert
 * semantics, in its existing layout and form: a block's form is fixed once
 * it has stanzas, not chosen per stanza, so `form` is ignored in this
 * branch) and focuses its first misra. Otherwise creates a new block (in
 * `layout`, forced to `single` whenever `form !== 'couplet'` — two-column
 * and staggered stay couplet-only) with one stanza, after the selection's
 * top-level element.
 */
export function $insertPoetryCouplet(layout: PoetryLayout, form: PoetryForm = DEFAULT_POETRY_FORM): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const existing = $getPoetryBlockFromSelection();
  if (existing) {
    return $insertCoupletRelativeToSelection('after');
  }
  if (!selection.isCollapsed()) {
    return $convertSelectionToPoetry(form);
  }

  const effectiveLayout = form === 'couplet' ? layout : 'single';
  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
  const node = $createPoetryBlockNode(effectiveLayout, undefined, undefined, undefined, undefined, undefined, form);
  const [misraA] = $appendCoupletTo(node);

  anchorTopLevel.insertAfter(node);
  $ensureTrailingParagraph(node);
  misraA.selectStart();
  return true;
}

/** Removes the stanza the selection is inside. If it's the block's only
 * stanza, removes the whole block (an empty poetry section serves no
 * purpose) — the explicit, always-available counterpart to
 * $deletePoetryOnBackspace's empty-stanza shortcut (mirrors the table
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

  $removeCoupletNodes(target, block.getLayout());
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
 * block's lines are grouped into fixed-size stanzas, so merging one line
 * away would shift every stanza after it (and take the previous stanza's
 * last line with it). Instead, Backspace at the start of an empty stanza
 * removes that stanza, and at the start of any other line it moves the
 * caret to the end of the previous line. Other caret positions (deleting
 * within text) fall through to normal handling.
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
  const stanza = couplets[coupletIndex];
  const misra = stanza[misraIndex];
  if (!$isPointAt(misra, selection.anchor, false)) return false;

  if (stanza.every((p) => p.isEmpty())) {
    if (couplets.length <= 1) {
      const previous = block.getPreviousSibling();
      block.remove();
      if ($isElementNode(previous)) previous.selectEnd();
      return true;
    }
    $removeCoupletNodes(stanza, block.getLayout());
    const remaining = $getCouplets(block);
    const previousCouplet = remaining[coupletIndex - 1] ?? remaining[0];
    previousCouplet?.[previousCouplet.length - 1]?.selectEnd();
    return true;
  }

  const previousLine = misraIndex > 0 ? stanza[misraIndex - 1] : couplets[coupletIndex - 1]?.[couplets[coupletIndex - 1].length - 1];
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
  const stanza = couplets[coupletIndex];
  const misra = stanza[misraIndex];
  if (!$isPointAt(misra, selection.anchor, true)) return false;

  const nextLine = misraIndex < stanza.length - 1 ? stanza[misraIndex + 1] : couplets[coupletIndex + 1]?.[0];
  nextLine?.selectStart();
  return true;
}

/**
 * Enter inside a poetry block never grows a stanza past its fixed size. The
 * block's *last* stanza being completely empty is always the exit trigger,
 * regardless of which of its (all-empty) misras the caret happens to be on
 * — pressing Enter once on a non-empty last stanza appends a fresh empty
 * one to continue into ("new stanza after last"), and pressing Enter again
 * on that still-untouched stanza exits ("double enter to exit the block"):
 * the same empty-item convention most editors use for lists. Outside that
 * case: pressed in any misra but the stanza's last, Enter moves the caret
 * to the next misra in the same stanza (already there; nothing inserted —
 * this is what stops ParagraphNode's default insertNewAfter from growing
 * the stanza, which would otherwise insert the new paragraph as a sibling
 * of wherever the caret was, i.e. still inside the stanza); pressed in the
 * last misra of a stanza that isn't the block's last, it moves to the next
 * stanza's first misra.
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
  const stanza = couplets[coupletIndex];
  const isLastCouplet = coupletIndex === couplets.length - 1;
  const coupletEmpty = stanza.every((p) => p.isEmpty());

  if (isLastCouplet && coupletEmpty) {
    // Drop the stanza we ourselves auto-created on the previous Enter —
    // unless it's the block's only stanza, in which case leave the section
    // as the user's (empty) content rather than deleting it.
    if (couplets.length > 1) $removeCoupletNodes(stanza, block.getLayout());
    const existingNext = block.getNextSibling();
    const paragraph = $isParagraphNode(existingNext) ? existingNext : $createParagraphNode();
    if (paragraph !== existingNext) block.insertAfter(paragraph);
    paragraph.select();
    return true;
  }

  if (misraIndex < stanza.length - 1) {
    stanza[misraIndex + 1].selectEnd();
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

/** Sets how many couplets share one side before the staggered layout flips
 * (request 3 — "auto" grouping). Only meaningful for `layout === 'staggered'`
 * (couplet-form only); a no-op otherwise. */
export function $setPoetryStaggerGroup(staggerGroup: PoetryStaggerGroup): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block || block.getLayout() !== 'staggered') return false;
  block.setStaggerGroup(staggerGroup);
  return true;
}

/**
 * Turns auto-width (fit-content, sized by the longest line, per request 2)
 * on or off for the caret's poetry block. Only valid in `layout === 'single'`
 * (a percentage/manual width inside a fit-content parent is circular) — a
 * no-op (returns false) when the block is in `two-column` or `staggered`.
 */
export function $setPoetryAutoWidth(autoWidth: boolean): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  if (autoWidth && block.getLayout() !== 'single') return false;
  block.setAutoWidth(autoWidth);
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

/** Removes the whole poetry block the caret is in, including every stanza. */
export function $deletePoetryBlock(): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  block.remove();
  return true;
}

/** Single-column blocks group their paragraphs into stanzas of
 * `POETRY_STANZA_SIZE[form]`, so a line left without a full stanza's worth
 * of partners (from pasted or imported content) would be invisible to the
 * stanza logic. Pad it out with empty partners instead, so every line
 * belongs to a stanza and can be deleted like any other. */
export function $completeSingleCoupletBlock(node: PoetryBlockNode): void {
  if (node.getLayout() === 'two-column') return;
  const size = POETRY_STANZA_SIZE[node.getForm()];
  const remainder = node.getChildrenSize() % size;
  if (remainder === 0) return;
  for (let i = remainder; i < size; i++) node.append($createParagraphNode());
}

/** The stanza a node (a misra paragraph, or anything inside one) belongs
 * to, with its block and index — or null outside a stanza. */
export function $getCoupletContaining(node: LexicalNode): { block: PoetryBlockNode; couplet: Couplet; index: number } | null {
  const block = $findMatchingParent(node, $isPoetryBlockNode);
  if (!block) return null;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, node);
  return position ? { block, couplet: couplets[position.coupletIndex], index: position.coupletIndex } : null;
}

/** Pulls a couplet's misras out of whatever currently holds them (and drops
 * a two-column row wrapper left behind, couplet form only). Returns whether
 * that row was a centered one, so the couplet can be rebuilt the same way
 * elsewhere. */
function $detachCouplet(couplet: Couplet): boolean {
  const row = $findCoupletRow(couplet);
  const centered = row ? $isCoupletRowCentered(row) : false;
  for (const misra of couplet) misra.remove();
  row?.remove();
  return centered;
}

/** The node(s) that hold a (detached) couplet in `layout`: the misras
 * themselves, or (couplet form only) one two-column row around them. */
function $wrapCouplet(layout: PoetryLayout, couplet: Couplet, centered: boolean): LexicalNode[] {
  if (layout !== 'two-column') return [...couplet];
  const [a, b] = couplet;
  const row = $createLayoutContainerNode(centered ? '1fr' : 'repeat(2, 1fr)');
  if (centered) row.append($createLayoutItemNode().append(a, b));
  else row.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
  return [row];
}

function $insertNodesRelativeTo(anchor: LexicalNode, nodes: LexicalNode[], position: 'before' | 'after'): void {
  let previous: LexicalNode | null = null;
  for (const node of nodes) {
    if (previous) previous.insertAfter(node);
    else if (position === 'before') anchor.insertBefore(node);
    else anchor.insertAfter(node);
    previous = node;
  }
}

/** Where a dragged stanza lands: next to another stanza (in its block,
 * whatever that block's layout), or next to a top-level block as a new
 * poetry block of its own. */
export type CoupletDropTarget =
  | { kind: 'couplet'; couplet: Couplet; position: 'before' | 'after' }
  | { kind: 'block'; block: LexicalNode; position: 'before' | 'after' };

/**
 * Moves a stanza — the drag-and-drop counterpart to the insert/delete
 * stanza actions. Dropped next to another stanza it joins that block,
 * rebuilt for that block's layout (its misra paragraphs move as they are,
 * so text, formatting and undo history survive) — the target block's own
 * form governs the move, same as the insert actions. Dropped next to an
 * ordinary block it becomes a new poetry block with the source block's
 * layout, form and settings. A source block left with no stanzas is
 * removed.
 */
export function $moveCouplet(couplet: Couplet, target: CoupletDropTarget): boolean {
  const source = $findMatchingParent(couplet[0], $isPoetryBlockNode);
  if (!source) return false;

  if (target.kind === 'couplet') {
    if (target.couplet[0].is(couplet[0])) return false;
    const targetBlock = $findMatchingParent(target.couplet[0], $isPoetryBlockNode);
    if (!targetBlock) return false;
    const layout = targetBlock.getLayout();
    const anchor = layout === 'two-column' ? $findCoupletRow(target.couplet) : target.position === 'before' ? target.couplet[0] : target.couplet[target.couplet.length - 1];
    if (!anchor) return false;
    const centered = $detachCouplet(couplet);
    $insertNodesRelativeTo(anchor, $wrapCouplet(layout, couplet, centered), target.position);
  } else {
    if (target.block.is(source) && $getCouplets(source).length <= 1) return false;
    const centered = $detachCouplet(couplet);
    const block = $createPoetryBlockNode(
      source.getLayout(),
      source.getWidth(),
      source.getSpacing(),
      source.getGutter(),
      source.getStagger(),
      source.getCenterWidth(),
      source.getForm(),
      source.getAutoWidth(),
      source.getStaggerGroup(),
    );
    block.append(...$wrapCouplet(source.getLayout(), couplet, centered));
    $insertNodesRelativeTo(target.block, [block], target.position);
    $ensureTrailingParagraph(block);
  }

  if (source.isAttached() && source.getChildrenSize() === 0) source.remove();
  couplet[0].selectStart();
  return true;
}

/**
 * Exchanges two misras' positions — the drag-and-drop action for a single
 * line. A swap (rather than a move) is the one line operation that keeps
 * every stanza intact in every layout: no stanza gains or loses a line, so
 * nothing after it re-pairs. Works across stanzas and across blocks.
 */
export function $swapMisras(a: ParagraphNode, b: ParagraphNode): boolean {
  if (a.is(b)) return false;
  const marker = $createParagraphNode();
  a.replace(marker);
  b.replace(a);
  marker.replace(b);
  a.selectStart();
  return true;
}
