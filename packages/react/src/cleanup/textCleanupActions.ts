import { $getRoot, $isParagraphNode, type TextNode } from 'lexical';

/** Runs of two or more spaces or tabs, collapsed to one space. */
const REPEATED_SPACE = /[ \t]{2,}/g;

/**
 * Tidies the whole document in place: Unicode NFC normalisation (Arabic-script
 * text can store the same visible letters in different code points), collapsed
 * repeated spaces, empty text nodes removed, and runs of two or more blank
 * paragraphs collapsed to one. Formatting is kept, since each text node is only
 * changed, never replaced. Returns how many text nodes and blank lines changed.
 */
export function $cleanUpText(): number {
  let changed = 0;
  for (const node of $getRoot().getAllTextNodes()) {
    if (cleanNode(node)) changed += 1;
  }
  changed += $collapseBlankParagraphs();
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

function cleanNode(node: TextNode): boolean {
  const text = node.getTextContent();
  const cleaned = text.normalize('NFC').replace(REPEATED_SPACE, ' ');
  if (cleaned === text) return false;
  if (cleaned === '') node.remove();
  else node.setTextContent(cleaned);
  return true;
}
