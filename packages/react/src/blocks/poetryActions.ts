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
  DEFAULT_POETRY_STANZA_VARIANT,
  POETRY_CENTER_WIDTHS,
  POETRY_GUTTERS,
  POETRY_SPACINGS,
  POETRY_STAGGERS,
  POETRY_STANZA_SIZE,
  SINGLE_COLUMN_SHAPED_LAYOUTS,
  STANZA_VARIANT_LAYOUTS,
  type PoetryBlockNode,
  type PoetryLayout,
  type PoetryStaggerGroup,
  type PoetryStanzaVariant,
} from './PoetryNode';

/** One stanza's misra paragraphs, in order — two for single/two-column/
 * staggered, five for mukhammas, six for musaddas (POETRY_STANZA_SIZE). The
 * name/type predate the musaddas/mukhammas generalization
 * (lexical-editor-spec.md §4.11, amended) and are kept for call-site
 * stability; every function below reads its length rather than assuming 2. */
export type Couplet = ParagraphNode[];

/**
 * A poetry block is a *section* of one or more stanzas sharing one layout
 * (single-column-shaped layouts — single/musaddas/mukhammas — stack each
 * stanza's misras directly as paragraph children, `POETRY_STANZA_SIZE[layout]`
 * deep per stanza; two-column gives each couplet its own LayoutContainerNode
 * row). This walks that structure and returns each stanza as an array, in
 * document order — the one place that knows how to read either shape, so
 * nothing else needs to.
 */
/** Reads one two-column row's misras (its one centered item, or its two
 * side-by-side items) — shared by the two-column branch and the `mixed`
 * stanza-variant branch below, since a `mixed` stanza's first two rows are
 * built exactly like a two-column couplet row. */
function $misrasFromRow(container: LayoutContainerNode): [ParagraphNode, ParagraphNode] | null {
  const items = container.getChildren().filter($isLayoutItemNode);
  if (items.length === 1) {
    const [a, b] = items[0].getChildren();
    return $isParagraphNode(a) && $isParagraphNode(b) ? [a, b] : null;
  }
  const a = items[0]?.getFirstChild();
  const b = items[1]?.getFirstChild();
  return $isParagraphNode(a) && $isParagraphNode(b) ? [a, b] : null;
}

/** Reads a mixed stanza's trailing misra(s) out of a single LayoutContainerNode
 * ('1fr') > LayoutItemNode wrapper — the centered-group encoding
 * $wrapTrailingGroup/$setCoupletCentered builds, holding all of the
 * stanza's trailing misras together in one item (1 for mukhammas, 2 for
 * musaddas — the same single-item encoding a centered two-column row uses
 * for its own two misras). Returns null for anything else (a bare flat
 * paragraph, or a container that isn't this exact shape). */
function $misrasFromTrailingGroup(node: LexicalNode): ParagraphNode[] | null {
  if (!$isLayoutContainerNode(node)) return null;
  const items = node.getChildren().filter($isLayoutItemNode);
  if (items.length !== 1) return null;
  const misras = items[0].getChildren();
  return misras.length > 0 && misras.every($isParagraphNode) ? (misras as ParagraphNode[]) : null;
}

export function $getCouplets(node: PoetryBlockNode): Couplet[] {
  const layout = node.getLayout();

  if (layout === 'two-column') {
    // two-column always pairs two misras per row.
    const containers = node.getChildren().filter($isLayoutContainerNode);
    const couplets: Couplet[] = [];
    for (const container of containers) {
      const pair = $misrasFromRow(container);
      if (pair) couplets.push(pair);
    }
    return couplets;
  }

  if (STANZA_VARIANT_LAYOUTS.has(layout) && node.getStanzaVariant() === 'mixed') {
    // A `mixed` stanza is 2 two-column rows (4 misras) immediately followed
    // by POETRY_STANZA_SIZE[layout] - 4 flat paragraphs — walk the block's
    // children consuming that fixed pattern repeatedly.
    const trailingCount = POETRY_STANZA_SIZE[layout] - 4;
    const children = node.getChildren();
    const couplets: Couplet[] = [];
    let i = 0;
    while (i + 1 < children.length) {
      const row1 = children[i];
      const row2 = children[i + 1];
      if (!$isLayoutContainerNode(row1) || !$isLayoutContainerNode(row2)) break;
      const pair1 = $misrasFromRow(row1);
      const pair2 = $misrasFromRow(row2);
      if (!pair1 || !pair2) break;

      // The trailing misras are either one combined centered-group wrapper
      // (consuming 1 physical child — $wrapTrailingGroup/$setCoupletCentered)
      // or `trailingCount` separate flat paragraphs (consuming `trailingCount`
      // physical children) — try the wrapped shape first, since it's always
      // exactly one node regardless of `trailingCount`.
      let trailing: ParagraphNode[] | null = null;
      let consumed = 0;
      const wrapped = $misrasFromTrailingGroup(children[i + 2]);
      if (wrapped && wrapped.length === trailingCount) {
        trailing = wrapped;
        consumed = 1;
      } else {
        const flat: ParagraphNode[] = [];
        for (let t = 0; t < trailingCount; t++) {
          const candidate = children[i + 2 + t];
          if (!$isParagraphNode(candidate)) break;
          flat.push(candidate);
        }
        if (flat.length === trailingCount) {
          trailing = flat;
          consumed = trailingCount;
        }
      }
      if (!trailing) break;
      couplets.push([...pair1, ...pair2, ...trailing]);
      i += 2 + consumed;
    }
    return couplets;
  }

  const size = POETRY_STANZA_SIZE[layout];
  const paragraphs = node.getChildren().filter($isParagraphNode);
  const couplets: Couplet[] = [];
  for (let i = 0; i + size - 1 < paragraphs.length; i += size) couplets.push(paragraphs.slice(i, i + size));
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

/** Whether a stanza in `layout`/`stanzaVariant` is built as 2 two-column
 * rows (4 misras) plus trailing flat paragraphs, rather than one flat run
 * (single/musaddas/mukhammas-continuous/-split) or one two-column row
 * (`layout === 'two-column'`). */
function $isMixedStanza(layout: PoetryLayout, stanzaVariant: PoetryStanzaVariant): boolean {
  return STANZA_VARIANT_LAYOUTS.has(layout) && stanzaVariant === 'mixed';
}

/** Whether `layout`/`stanzaVariant` has a row/group that can be
 * centered/narrowed at all — a two-column couplet's own row, or a mixed
 * musaddas/mukhammas stanza's trailing misra group (1 line for mukhammas,
 * 2 for musaddas — see $wrapTrailingGroup). */
function $isCenterableStanza(layout: PoetryLayout, stanzaVariant: PoetryStanzaVariant): boolean {
  return layout === 'two-column' || $isMixedStanza(layout, stanzaVariant);
}

/** Wraps a mixed stanza's trailing misra(s) — together, as one group — in a
 * LayoutContainerNode('1fr') > LayoutItemNode, in place — the exact same
 * single-item encoding a centered two-column row uses for its own two
 * misras, just holding however many trailing misras this stanza has (1 for
 * mukhammas, 2 for musaddas) instead of always two. Builds the wrapper at
 * the first misra's current position (inserted as its sibling first, then
 * every misra moved inside it, in order) so this also works on already-
 * attached misras, not just fresh ones. */
function $wrapTrailingGroup(misras: ParagraphNode[]): LayoutContainerNode {
  const row = $createLayoutContainerNode('1fr');
  const item = $createLayoutItemNode();
  const [first] = misras;
  if (first.isAttached()) first.insertAfter(row);
  row.append(item);
  item.append(...misras);
  return row;
}

/**
 * Builds the physical node(s) for one stanza's `misras` — the one place
 * that knows how to *build* any of the three physical shapes $getCouplets
 * knows how to *read*, so insert/delete/layout-change/variant-change/drag-move
 * all construct a stanza the same way:
 *  - `layout === 'two-column'`: one row (centered, single item, when
 *    `centered`; otherwise one item per misra) — `misras` is always length 2.
 *  - musaddas/mukhammas with `stanzaVariant === 'mixed'`: 2 two-column rows
 *    (the first 4 misras, 2 per row) followed by the remaining misras —
 *    `misras.length` is `POETRY_STANZA_SIZE[layout]`. `centered` controls
 *    whether those trailing misras (1 for mukhammas, 2 for musaddas) are
 *    wrapped together, as one group, centered/narrowed the same way a
 *    two-column row is ($wrapTrailingGroup) — when false, they're plain
 *    flat siblings instead.
 *  - everything else: the misras themselves, as flat siblings.
 *
 * `centered`'s default is smart, not a flat `false`: every call site that
 * doesn't already have an opinion (a fresh stanza, a layout/variant change,
 * $setPoetryStanzaVariant's rebuild) gets `false` for a two-column row
 * (unchanged — centering a couplet has always been an explicit opt-in) but
 * `true` for a mixed stanza's trailing group, matching how that shape is
 * depicted everywhere it's chosen (the IconPoetryMixed glyph, the reference
 * site) — centered-by-default, not full-width-by-default. Call sites that
 * DO have an opinion (drag-move, preserving whatever state $detachCouplet
 * read off the source) pass `centered` explicitly and bypass this default
 * entirely. */
function $buildCoupletNodes(
  layout: PoetryLayout,
  stanzaVariant: PoetryStanzaVariant,
  misras: ParagraphNode[],
  centered: boolean = $isMixedStanza(layout, stanzaVariant),
): LexicalNode[] {
  if (layout === 'two-column') {
    const [a, b] = misras;
    const row = $createLayoutContainerNode(centered ? '1fr' : 'repeat(2, 1fr)');
    if (centered) row.append($createLayoutItemNode().append(a, b));
    else row.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
    return [row];
  }
  // Guarded by length, not just layout/variant: a drag-moved stanza can
  // arrive with a different misra count than the target block's own stanza
  // size (e.g. a 2-line couplet dropped onto a mixed musaddas stanza) — the
  // same size mismatch every other branch here already tolerates (by just
  // using however many misras it was given), rather than destructuring into
  // `undefined` layout items.
  if ($isMixedStanza(layout, stanzaVariant) && misras.length >= 4) {
    const [a, b, c, d, ...rest] = misras;
    const row1 = $createLayoutContainerNode('repeat(2, 1fr)');
    row1.append($createLayoutItemNode().append(a), $createLayoutItemNode().append(b));
    const row2 = $createLayoutContainerNode('repeat(2, 1fr)');
    row2.append($createLayoutItemNode().append(c), $createLayoutItemNode().append(d));
    const trailing: LexicalNode[] = centered && rest.length > 0 ? [$wrapTrailingGroup(rest)] : rest;
    return [row1, row2, ...trailing];
  }
  return [...misras];
}

/** The physical node a mixed stanza's trailing misra occupies as a direct
 * sibling of the block's other children — the misra paragraph itself when
 * bare (every trailing misra its own sibling), or the shared
 * LayoutContainerNode wrapper all of them sit inside when centered as one
 * group (via $wrapTrailingGroup/$setCoupletCentered) — every trailing misra
 * in a centered group maps to the SAME wrapper node. Every operation that
 * treats a trailing misra as a sibling node to insert/remove/anchor next to
 * ($findCoupletBounds, $removeCoupletNodes, $detachCouplet) goes through
 * this rather than assuming the misra itself is that sibling, and dedupes
 * (e.g. via a Set) when iterating more than one trailing misra, since a
 * centered group's misras all resolve to one shared node. */
function $trailingSlotNode(misra: ParagraphNode): LexicalNode {
  return ($findMatchingParent(misra, $isLayoutContainerNode) as LayoutContainerNode | null) ?? misra;
}

/** Whether a mixed stanza's trailing misra group (1 line for mukhammas, 2
 * for musaddas) is currently centered/wrapped — checking any one of its
 * misras is enough, since a centered group's misras all share the same
 * wrapper. False (and safe) for an empty group. */
function $isTrailingGroupCentered(misras: ParagraphNode[]): boolean {
  return misras.length > 0 && $trailingSlotNode(misras[0]) !== misras[0];
}

/** The first/last physical node holding a stanza — the anchor(s) insert/move
 * operations attach new siblings next to, for whichever of the three shapes
 * $getCouplets/$buildCoupletNodes work with. */
function $findCoupletBounds(layout: PoetryLayout, stanzaVariant: PoetryStanzaVariant, couplet: Couplet): { first: LexicalNode; last: LexicalNode } {
  if (layout === 'two-column') {
    const row = $findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null;
    if (row) return { first: row, last: row };
  } else if ($isMixedStanza(layout, stanzaVariant)) {
    const row1 = $findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null;
    const last =
      couplet.length > 4
        ? $trailingSlotNode(couplet[couplet.length - 1])
        : ($findMatchingParent(couplet[2], $isLayoutContainerNode) as LayoutContainerNode | null);
    if (row1 && last) return { first: row1, last };
  }
  return { first: couplet[0], last: couplet[couplet.length - 1] };
}

/** Removes a stanza's nodes from the tree, for whichever physical shape
 * `layout`/`stanzaVariant` builds: its single two-column row
 * (`layout === 'two-column'`), its 2 two-column rows plus trailing flat
 * paragraphs or centered trailing wrapper (musaddas/mukhammas `mixed` —
 * $trailingSlotNode), or every one of its misra paragraphs otherwise. */
function $removeCoupletNodes(couplet: Couplet, layout: PoetryLayout, stanzaVariant: PoetryStanzaVariant): void {
  if (layout === 'two-column') {
    const container = $findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null;
    if (container) {
      container.remove();
      return;
    }
  } else if ($isMixedStanza(layout, stanzaVariant)) {
    const row1 = $findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null;
    const row2 = $findMatchingParent(couplet[2], $isLayoutContainerNode) as LayoutContainerNode | null;
    row1?.remove();
    row2?.remove();
    // A centered trailing group's misras all share one wrapper node — dedupe
    // by node key before removing, so a shared wrapper isn't `.remove()`d
    // more than once (musaddas's 2-misra group; mukhammas's 1-misra group
    // never needs this, but the dedup is harmless either way).
    const trailingNodes = new Map<string, LexicalNode>();
    for (const misra of couplet.slice(4)) {
      const node = $trailingSlotNode(misra);
      trailingNodes.set(node.getKey(), node);
    }
    for (const node of trailingNodes.values()) node.remove();
    return;
  }
  for (const misra of couplet) misra.remove();
}

function $appendCoupletTo(node: PoetryBlockNode): Couplet {
  const size = POETRY_STANZA_SIZE[node.getLayout()];
  const misras = Array.from({ length: size }, () => $createParagraphNode());
  node.append(...$buildCoupletNodes(node.getLayout(), node.getStanzaVariant(), misras));
  return misras;
}

/**
 * Inserts a new, empty stanza immediately before or after an existing one —
 * the table-row-insert equivalent for a poetry block ("add/remove couplets
 * just like adding/removing table rows"). `existingStanza` is the whole
 * stanza to insert next to, so its physical bounds ($findCoupletBounds) can
 * be located regardless of layout, stanza size or stanza variant.
 */
function $insertCoupletRelativeTo(existingStanza: Couplet, block: PoetryBlockNode, position: 'before' | 'after'): Couplet {
  const layout = block.getLayout();
  const stanzaVariant = block.getStanzaVariant();
  const size = POETRY_STANZA_SIZE[layout];
  const misras = Array.from({ length: size }, () => $createParagraphNode());
  const nodes = $buildCoupletNodes(layout, stanzaVariant, misras);
  const bounds = $findCoupletBounds(layout, stanzaVariant, existingStanza);
  $insertNodesRelativeTo(position === 'before' ? bounds.first : bounds.last, nodes, position);
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
 * Converts every stanza in the block from its current layout to a new one,
 * in place — flattens every misra paragraph across the block's current
 * stanzas (via $getMisraParagraphs, regardless of layout or stanza size)
 * and re-chunks that flat sequence into groups of the *target* layout's
 * stanza size (POETRY_STANZA_SIZE[layout]), left to right, padding the
 * final group with empty paragraphs if it falls short — then rebuilds the
 * block's children in the target layout's shape: flat paragraphs for
 * single/musaddas/mukhammas, or two-column LayoutContainerNode rows (built
 * on the columns primitive, §4.9) for two-column/staggered. Reaching
 * two-column/staggered only ever produces 2-line groups, since the source
 * is either already couplet-sized (single/two-column/staggered, all size
 * 2) or is itself being re-chunked to size 2 first (musaddas/mukhammas).
 * When the stanza size doesn't change (every single/two-column/staggered
 * transition among themselves) this reproduces exactly the original stanza
 * grouping — the same couplets, just rewrapped — so no separate fast path
 * is needed for that case. Preserves stanza order and the moved paragraphs'
 * own node identity, so content, selection and undo history all survive the
 * conversion. A no-op when the block is already in the target layout.
 * Switching to `two-column`/`staggered` also clears autoWidth (valid only
 * for the single-column-shaped layouts — a percentage/fit-content width is
 * only well-defined in a single-column flow), and forces `stanzaVariant`
 * back to `'continuous'` (only meaningful for musaddas/mukhammas) — moving
 * *between* musaddas and mukhammas keeps the current variant, rebuilt at
 * the new stanza size ($buildCoupletNodes already does this: a `mixed`
 * stanza's trailing flat-paragraph count is `POETRY_STANZA_SIZE[layout] - 4`,
 * whatever that layout's own stanza size is).
 */
export function $setPoetryLayout(node: PoetryBlockNode, layout: PoetryLayout): void {
  if (node.getLayout() === layout) return;

  const misras = $getMisraParagraphs(node);
  const toSize = POETRY_STANZA_SIZE[layout];

  // Removing a misra paragraph below (to re-append it in its new row/group)
  // moves the selection away the moment it's detached, even though it lands
  // back in the same paragraph a few lines later — so the caret ends up
  // outside the block entirely unless it's explicitly restored afterward.
  const selection = $getSelection();
  const anchor = $isRangeSelection(selection) ? { key: selection.anchor.key, offset: selection.anchor.offset, type: selection.anchor.type } : null;
  const focus = $isRangeSelection(selection) ? { key: selection.focus.key, offset: selection.focus.offset, type: selection.focus.type } : null;

  for (const misra of misras) misra.remove();
  for (const leftover of node.getChildren()) leftover.remove();

  const groups: ParagraphNode[][] = [];
  for (let i = 0; i < misras.length; i += toSize) groups.push(misras.slice(i, i + toSize));
  if (groups.length === 0) groups.push([]);
  const lastGroup = groups[groups.length - 1];
  while (lastGroup.length < toSize) lastGroup.push($createParagraphNode());

  if (!STANZA_VARIANT_LAYOUTS.has(layout) && node.getStanzaVariant() !== DEFAULT_POETRY_STANZA_VARIANT) {
    node.setStanzaVariantAttribute(DEFAULT_POETRY_STANZA_VARIANT);
  }
  const stanzaVariant = node.getStanzaVariant();
  for (const group of groups) node.append(...$buildCoupletNodes(layout, stanzaVariant, group));
  node.setLayoutAttribute(layout);
  if (!SINGLE_COLUMN_SHAPED_LAYOUTS.has(layout) && node.getAutoWidth()) node.setAutoWidth(false);

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
 * Turns the blocks the selection spans into one single-column-shaped poetry
 * block ("select multiple lines and press the poetry command"): each
 * selected block's lines (see $blockToPoetryLines) become consecutive
 * misras, grouped `POETRY_STANZA_SIZE[layout]` to a stanza in order, padding
 * the final stanza out with empty lines if it falls short. `layout` must be
 * one of the single-column-shaped layouts (single/musaddas/mukhammas) —
 * a flat text selection can't be arranged into two-column's row structure,
 * so a `two-column`/`staggered` request falls back to `single`, same as
 * before this layout/form merge. The new block takes the place of the
 * first selected block and the rest are removed. Returns false, changing
 * nothing, when the selection is collapsed, already inside a poetry block,
 * or holds no non-blank text.
 */
export function $convertSelectionToPoetry(layout: PoetryLayout = 'single'): boolean {
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

  const effectiveLayout = SINGLE_COLUMN_SHAPED_LAYOUTS.has(layout) ? layout : 'single';
  const node = $createPoetryBlockNode(effectiveLayout);
  for (const line of lines) node.append($createParagraphNode().append(...line));
  $completeSingleCoupletBlock(node);

  blocks[0].insertBefore(node);
  for (const block of blocks) block.remove();
  $ensureTrailingParagraph(node);
  (node.getFirstChild() as ParagraphNode).selectStart();
  return true;
}

/**
 * Inserts a poetry stanza at the caret, in `layout` — one of the five flat
 * layout choices (single/two-column/staggered/musaddas/mukhammas), which
 * now carries both the arrangement and the stanza size
 * (POETRY_STANZA_SIZE[layout]) in one value. With text selected outside a
 * poetry block, converts the selected lines into a single-column-shaped
 * block instead (see $convertSelectionToPoetry — a flat text selection
 * can't become a two-column/staggered row structure, so that request falls
 * back to `single` there). If the caret is already inside a poetry block,
 * inserts a new stanza right after the one the caret is in (same as the
 * "Insert couplet below" menu action — table-row-insert semantics, in the
 * block's own existing layout: a block's layout is fixed once it has
 * stanzas, not chosen per stanza, so `layout` is ignored in this branch)
 * and focuses its first misra. Otherwise creates a new block in `layout`
 * with one stanza, after the selection's top-level element.
 */
export function $insertPoetryCouplet(layout: PoetryLayout): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const existing = $getPoetryBlockFromSelection();
  if (existing) {
    return $insertCoupletRelativeToSelection('after');
  }
  if (!selection.isCollapsed()) {
    return $convertSelectionToPoetry(layout);
  }

  const anchorTopLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
  const node = $createPoetryBlockNode(layout);
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

  $removeCoupletNodes(target, block.getLayout(), block.getStanzaVariant());
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
    $removeCoupletNodes(stanza, block.getLayout(), block.getStanzaVariant());
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
    if (couplets.length > 1) $removeCoupletNodes(stanza, block.getLayout(), block.getStanzaVariant());
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
 * (request 3 — "auto" grouping). Only meaningful for `layout === 'staggered'`;
 * a no-op otherwise. */
export function $setPoetryStaggerGroup(staggerGroup: PoetryStaggerGroup): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block || block.getLayout() !== 'staggered') return false;
  block.setStaggerGroup(staggerGroup);
  return true;
}

/**
 * Turns auto-width (fit-content, sized by the longest line, per request 2)
 * on or off for the caret's poetry block. Only valid for the
 * single-column-shaped layouts (single/musaddas/mukhammas — a
 * percentage/manual width inside a fit-content parent is circular) — a
 * no-op (returns false) when the block is in `two-column` or `staggered`.
 */
export function $setPoetryAutoWidth(autoWidth: boolean): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  if (autoWidth && !SINGLE_COLUMN_SHAPED_LAYOUTS.has(block.getLayout())) return false;
  block.setAutoWidth(autoWidth);
  return true;
}

/**
 * Converts every stanza in the caret's block between the three
 * `stanzaVariant` choices (continuous/split/mixed — see PoetryNode.tsx),
 * preserving every misra's content and the caret's own position, same
 * selection-preserving pattern as $setPoetryLayout. Only meaningful for
 * musaddas/mukhammas — a no-op (returns false) for any other layout. A
 * no-op (returns true, nothing to rebuild) when already in the requested
 * variant.
 */
export function $setPoetryStanzaVariant(stanzaVariant: PoetryStanzaVariant): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block || !STANZA_VARIANT_LAYOUTS.has(block.getLayout())) return false;
  if (block.getStanzaVariant() === stanzaVariant) return true;

  const layout = block.getLayout();
  const stanzas = $getCouplets(block).map((couplet) => [...couplet]);

  const selection = $getSelection();
  const anchor = $isRangeSelection(selection) ? { key: selection.anchor.key, offset: selection.anchor.offset, type: selection.anchor.type } : null;
  const focus = $isRangeSelection(selection) ? { key: selection.focus.key, offset: selection.focus.offset, type: selection.focus.type } : null;

  for (const stanza of stanzas) for (const misra of stanza) misra.remove();
  for (const leftover of block.getChildren()) leftover.remove();

  block.setStanzaVariantAttribute(stanzaVariant);
  for (const stanza of stanzas) block.append(...$buildCoupletNodes(layout, stanzaVariant, stanza));

  if (anchor && focus) {
    const restored = $createRangeSelection();
    restored.anchor.set(anchor.key, anchor.offset, anchor.type);
    restored.focus.set(focus.key, focus.offset, focus.type);
    $setSelection(restored);
  }
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

/** Whether the couplet/line the caret is in is centered, or null outside a
 * centerable poetry block/stanza ($isCenterableStanza — a two-column
 * couplet, or a mixed musaddas/mukhammas stanza's trailing misra group). */
export function $getCoupletCenteredFromSelection(): boolean | null {
  const block = $getPoetryBlockFromSelection();
  if (!block) return null;
  const layout = block.getLayout();
  const stanzaVariant = block.getStanzaVariant();
  if (!$isCenterableStanza(layout, stanzaVariant)) return null;
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return null;
  const couplet = couplets[position.coupletIndex];

  if ($isMixedStanza(layout, stanzaVariant)) {
    return $isTrailingGroupCentered(couplet.slice(4));
  }
  const row = $findCoupletRow(couplet);
  return row ? $isCoupletRowCentered(row) : false;
}

/** Centers (or un-centers) the caret's couplet/line — a two-column couplet's
 * row (rebuilt around its same two misra paragraphs), or a mixed
 * musaddas/mukhammas stanza's trailing misra group (wrapped/unwrapped
 * together via $wrapTrailingGroup, in place) — whichever $isCenterableStanza
 * applies to the caret's block. */
export function $setCoupletCentered(centered: boolean): boolean {
  const block = $getPoetryBlockFromSelection();
  if (!block) return false;
  const layout = block.getLayout();
  const stanzaVariant = block.getStanzaVariant();
  if (!$isCenterableStanza(layout, stanzaVariant)) return false;
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const couplets = $getCouplets(block);
  const position = $findCoupletPosition(couplets, selection.anchor.getNode());
  if (!position) return false;
  const couplet = couplets[position.coupletIndex];

  if ($isMixedStanza(layout, stanzaVariant)) {
    const trailing = couplet.slice(4);
    if (trailing.length === 0) return false;
    if ($isTrailingGroupCentered(trailing) === centered) return true;
    if (centered) {
      $wrapTrailingGroup(trailing);
    } else {
      const wrapper = $trailingSlotNode(trailing[0]);
      let anchor: LexicalNode = wrapper;
      for (const misra of trailing) {
        anchor.insertAfter(misra);
        anchor = misra;
      }
      wrapper.remove();
    }
    trailing[0].selectStart();
    return true;
  }

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

/** Single-column-shaped blocks group their paragraphs into stanzas of
 * `POETRY_STANZA_SIZE[layout]`, so a line left without a full stanza's worth
 * of partners (from pasted or imported content) would be invisible to the
 * stanza logic. Pad it out with empty partners instead, so every line
 * belongs to a stanza and can be deleted like any other. Skipped for
 * `two-column` (rows, not flat paragraphs — nothing to pad this way) and for
 * a `mixed` musaddas/mukhammas stanza (2 rows + trailing flats, not a flat
 * run either — and, unlike continuous/split, a `mixed` stanza is always
 * built whole via $buildCoupletNodes rather than grown misra-by-misra, so it
 * never needs this kind of repair; the plain `% size` remainder check below
 * would also be wrong for it, since a mixed stanza's own child count is
 * `2 + (POETRY_STANZA_SIZE[layout] - 4)`, not `POETRY_STANZA_SIZE[layout]`). */
export function $completeSingleCoupletBlock(node: PoetryBlockNode): void {
  const layout = node.getLayout();
  if (layout === 'two-column' || $isMixedStanza(layout, node.getStanzaVariant())) return;
  const size = POETRY_STANZA_SIZE[layout];
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
 * any row wrapper(s) left behind — one for `layout === 'two-column'`, two
 * for a musaddas/mukhammas `mixed` stanza, plus its trailing misra group's
 * own centered wrapper, via $trailingSlotNode, if there is one). Returns
 * whether a two-column row, or a mixed stanza's trailing group, was
 * centered, so the couplet can be rebuilt the same way elsewhere. */
function $detachCouplet(layout: PoetryLayout, stanzaVariant: PoetryStanzaVariant, couplet: Couplet): boolean {
  if (layout === 'two-column') {
    const row = $findCoupletRow(couplet);
    const centered = row ? $isCoupletRowCentered(row) : false;
    for (const misra of couplet) misra.remove();
    row?.remove();
    return centered;
  }
  if ($isMixedStanza(layout, stanzaVariant)) {
    const row1 = $findMatchingParent(couplet[0], $isLayoutContainerNode) as LayoutContainerNode | null;
    const row2 = $findMatchingParent(couplet[2], $isLayoutContainerNode) as LayoutContainerNode | null;
    const trailing = couplet.slice(4);
    const centered = $isTrailingGroupCentered(trailing);
    for (const misra of couplet.slice(0, 4)) misra.remove();
    // Dedupe by node key — a centered group's misras all share one wrapper
    // node (same reasoning as $removeCoupletNodes).
    const trailingNodes = new Map<string, LexicalNode>();
    for (const misra of trailing) {
      const node = $trailingSlotNode(misra);
      trailingNodes.set(node.getKey(), node);
    }
    for (const node of trailingNodes.values()) node.remove();
    row1?.remove();
    row2?.remove();
    return centered;
  }
  for (const misra of couplet) misra.remove();
  return false;
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
 * layout governs the move, same as the insert actions. Dropped next to an
 * ordinary block it becomes a new poetry block with the source block's
 * layout and settings. A source block left with no stanzas is removed.
 */
export function $moveCouplet(couplet: Couplet, target: CoupletDropTarget): boolean {
  const source = $findMatchingParent(couplet[0], $isPoetryBlockNode);
  if (!source) return false;
  const sourceLayout = source.getLayout();
  const sourceVariant = source.getStanzaVariant();

  if (target.kind === 'couplet') {
    if (target.couplet[0].is(couplet[0])) return false;
    const targetBlock = $findMatchingParent(target.couplet[0], $isPoetryBlockNode);
    if (!targetBlock) return false;
    const layout = targetBlock.getLayout();
    const stanzaVariant = targetBlock.getStanzaVariant();
    const bounds = $findCoupletBounds(layout, stanzaVariant, target.couplet);
    const anchor = target.position === 'before' ? bounds.first : bounds.last;
    const centered = $detachCouplet(sourceLayout, sourceVariant, couplet);
    $insertNodesRelativeTo(anchor, $buildCoupletNodes(layout, stanzaVariant, couplet, centered), target.position);
  } else {
    if (target.block.is(source) && $getCouplets(source).length <= 1) return false;
    const centered = $detachCouplet(sourceLayout, sourceVariant, couplet);
    const block = $createPoetryBlockNode(
      sourceLayout,
      source.getWidth(),
      source.getSpacing(),
      source.getGutter(),
      source.getStagger(),
      source.getCenterWidth(),
      source.getAutoWidth(),
      source.getStaggerGroup(),
      sourceVariant,
    );
    block.append(...$buildCoupletNodes(sourceLayout, sourceVariant, couplet, centered));
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
