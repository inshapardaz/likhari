import type { SerializedEditorState } from 'lexical';
import { FORMAT_CODE, rootChildren, type SNode } from '../shared/serialized';

/** Runs of two or more spaces or tabs: the same rule as the editor's own text cleanup. */
const REPEATED_SPACE = /[ \t]{2,}/g;

const isText = (node: SNode) => node.type === 'text';
const isCode = (node: SNode) => (Number(node.format ?? 0) & FORMAT_CODE) !== 0;

/** Two text runs that look the same, so can be one run. */
function sameLook(a: SNode, b: SNode): boolean {
  return isText(a) && isText(b) && a.format === b.format && a.style === b.style && a.mode === b.mode && a.detail === b.detail;
}

/** Drops spaces from the end of the last kept text run (not code), removing the run if nothing is left. */
function trimEnd(tidy: SNode[]): void {
  const last = tidy[tidy.length - 1];
  if (!last || !isText(last) || isCode(last)) return;
  last.text = String(last.text).replace(/[ \t]+$/, '');
  if (last.text === '') tidy.pop();
}

/** The text a run of nodes ends with, looking into a trailing link. */
function endsWithSpace(nodes: SNode[]): boolean {
  const last = nodes[nodes.length - 1];
  if (!last) return false;
  if (last.children && !last.children.some((c) => c.children)) return endsWithSpace(last.children);
  return isText(last) && !isCode(last) && /[ \t]$/.test(String(last.text ?? ''));
}

/**
 * Cleans the inline content of one element: merge look-alike runs, tidy spaces, drop empty runs.
 * `trimEdges` trims the start and end of a block; `afterSpace` says the text before these children
 * already ended in a space, so a space they start with is a double one.
 */
function cleanInline(children: SNode[], trimEdges: boolean, afterSpace = false): SNode[] {
  // Merge neighbours that look the same, so a space split across two runs is seen as one.
  const merged: SNode[] = [];
  for (const child of children) {
    const last = merged[merged.length - 1];
    if (last && sameLook(last, child)) last.text = String(last.text ?? '') + String(child.text ?? '');
    else merged.push(child);
  }

  let previousEndsWithSpace = trimEdges || afterSpace; // at the start of a block a space is a stray one
  const tidy: SNode[] = [];
  for (const node of merged) {
    if (!isText(node)) {
      if (node.type === 'link' || node.type === 'autolink') {
        // A link's text is cleaned in place, but a space doubled across its edge is still a double space.
        node.children = cleanInline(node.children ?? [], false, previousEndsWithSpace);
        previousEndsWithSpace = endsWithSpace(node.children);
      } else if (node.type === 'linebreak') {
        trimEnd(tidy); // spaces at the end of a line
        previousEndsWithSpace = true;
      } else if (node.children) {
        // A nested block, a list inside a list item: the text before it ends there.
        trimEnd(tidy);
        cleanNode(node);
        previousEndsWithSpace = true;
      } else {
        previousEndsWithSpace = node.type === 'tab';
      }
      tidy.push(node);
      continue;
    }
    let text = String(node.text ?? '').normalize('NFC');
    if (!isCode(node)) {
      text = text.replace(REPEATED_SPACE, ' ');
      if (previousEndsWithSpace) text = text.replace(/^[ \t]+/, '');
    }
    if (text === '') continue;
    node.text = text;
    previousEndsWithSpace = !isCode(node) && /[ \t]$/.test(text);
    tidy.push(node);
  }

  if (trimEdges) trimEnd(tidy);
  return tidy;
}

function cleanNode(node: SNode): void {
  const children = node.children;
  if (!children) return;
  const hasInline = children.some((child) => isText(child) || child.type === 'linebreak' || child.type === 'tab' || child.type === 'link' || child.type === 'autolink');
  if (hasInline) node.children = cleanInline(children, true);
  else children.forEach(cleanNode);
}

/**
 * Tidies a document in place, the way the editor's "clean up text" does and a little further:
 * Unicode NFC (Arabic-script text can store the same letters in different code points), runs of
 * spaces or tabs collapsed to one, text runs with the same formatting merged, empty runs removed,
 * and stray spaces at the start and end of each block trimmed. Text with the code format is left
 * exactly as written. Structure, empty paragraphs and everything that is not text are untouched.
 */
export function cleanState(state: SerializedEditorState): SerializedEditorState {
  rootChildren(state).forEach(cleanNode);
  return state;
}
