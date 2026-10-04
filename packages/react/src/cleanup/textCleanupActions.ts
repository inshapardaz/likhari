import { $getRoot, type TextNode } from 'lexical';

/** Runs of two or more spaces or tabs, collapsed to one space. */
const REPEATED_SPACE = /[ \t]{2,}/g;

/**
 * Tidies the whole document in place: Unicode NFC normalisation (Arabic-script
 * text can store the same visible letters in different code points), collapsed
 * repeated spaces, and empty text nodes removed. Formatting is kept, since each
 * text node is only changed, never replaced. Returns how many text nodes changed.
 */
export function $cleanUpText(): number {
  let changed = 0;
  for (const node of $getRoot().getAllTextNodes()) {
    if (cleanNode(node)) changed += 1;
  }
  return changed;
}

function cleanNode(node: TextNode): boolean {
  const text = node.getTextContent();
  const cleaned = text.normalize('NFC').replace(REPEATED_SPACE, ' ');
  if (cleaned === text) return false;
  if (cleaned === '') node.remove();
  else node.setTextContent(cleaned);
  return true;
}
