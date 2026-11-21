import { $getRoot, $isElementNode, $isParagraphNode, type TextNode } from 'lexical';
import { $locate, $replaceMatch, $textGroups } from '../find/findReplaceActions';

/** Runs of two or more spaces or tabs, collapsed to one space. */
const REPEATED_SPACE = /[ \t]{2,}/g;
/** A run of spaces or tabs at the very start of a string. */
const LEADING_SPACE = /^[ \t]+/;

/**
 * Tidies the whole document in place: a leading space trimmed from each
 * block, Unicode NFC normalisation (Arabic-script text can store the same
 * visible letters in different code points), empty text nodes removed,
 * repeated spaces collapsed, and runs of two or more blank paragraphs
 * collapsed to one. Returns how many text nodes and blank lines changed.
 */
export function $cleanUpText(): number {
  let changed = $trimLeadingBlockSpace();
  for (const node of $getRoot().getAllTextNodes()) {
    if (normalizeNode(node)) changed += 1;
  }
  changed += $collapseRepeatedSpaces();
  changed += $collapseBlankParagraphs();
  return changed;
}

/**
 * Removes a leading space or tab from the start of each top-level block
 * (e.g. a stray space left over from a paste). A block whose first text
 * node is entirely spaces has that node removed outright, so a block split
 * into several leading space-only nodes still ends up with none.
 */
function $trimLeadingBlockSpace(): number {
  let changed = 0;
  for (const block of $getRoot().getChildren()) {
    if (!$isElementNode(block)) continue;
    for (const node of block.getAllTextNodes()) {
      const text = node.getTextContent();
      if (text === '') continue;
      const trimmed = text.replace(LEADING_SPACE, '');
      if (trimmed === text) break;
      changed += 1;
      if (trimmed === '') {
        node.remove();
        continue;
      }
      node.setTextContent(trimmed);
      break;
    }
  }
  return changed;
}

/**
 * Collapses runs of two or more spaces/tabs to one space, across the whole
 * paragraph or cell rather than one text node at a time — a run split across
 * two adjacent text nodes (e.g. around a differently formatted span, or from
 * a paste) would otherwise only be half-collapsed on each side, leaving a
 * stray space behind.
 */
function $collapseRepeatedSpaces(): number {
  let changed = 0;
  for (const group of $textGroups()) {
    const text = group.map((node) => node.getTextContent()).join('');
    const matches = [...text.matchAll(REPEATED_SPACE)];
    for (const match of matches.reverse()) {
      const start = match.index;
      const end = start + match[0].length;
      const from = $locate(group, start, false);
      const to = $locate(group, end, true);
      $replaceMatch({ anchorKey: from.key, anchorOffset: from.offset, focusKey: to.key, focusOffset: to.offset }, ' ');
      changed += 1;
    }
  }
  return changed;
}

/** Removes every blank paragraph that directly follows another blank one, keeping the first. */
function $collapseBlankParagraphs(): number {
  let removed = 0;
  let previousWasBlank = false;
  for (const child of $getRoot().getChildren()) {
    const isBlank = $isParagraphNode(child) && child.getTextContent() === '';
    if (isBlank && previousWasBlank) {
      child.remove();
      removed += 1;
    } else {
      previousWasBlank = isBlank;
    }
  }
  return removed;
}

function normalizeNode(node: TextNode): boolean {
  const text = node.getTextContent();
  const normalized = text.normalize('NFC');
  if (normalized === text) return false;
  if (normalized === '') node.remove();
  else node.setTextContent(normalized);
  return true;
}
