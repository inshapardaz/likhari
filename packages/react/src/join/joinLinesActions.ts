import {
  $createTextNode,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $createParagraphNode,
  type LexicalNode,
  type LineBreakNode,
  type ParagraphNode,
  type RangeSelection,
} from 'lexical';

function $paragraphsInSelection(selection: RangeSelection): ParagraphNode[] {
  const seen = new Set<string>();
  const paragraphs: ParagraphNode[] = [];
  for (const node of selection.getNodes()) {
    const block = node.getTopLevelElement();
    if (!block || !$isParagraphNode(block) || seen.has(block.getKey())) continue;
    seen.add(block.getKey());
    paragraphs.push(block);
  }
  return paragraphs;
}

export function $canJoinLines(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
  if ($paragraphsInSelection(selection).length > 1) return true;
  return selection.getNodes().some($isLineBreakNode);
}

/** A soft break becomes one space, unless the text either side already has a space there. */
function $replaceBreakWithSpace(lineBreak: LexicalNode): void {
  const before = lineBreak.getPreviousSibling()?.getTextContent() ?? '';
  const after = lineBreak.getNextSibling()?.getTextContent() ?? '';
  if (before === '' || after === '' || /\s$/.test(before) || /^\s/.test(after)) {
    lineBreak.remove();
    return;
  }
  lineBreak.replace($createTextNode(' '));
}

/** Moves a paragraph's content onto the end of the target, with a space between when needed. */
function $appendParagraph(target: ParagraphNode, paragraph: ParagraphNode): void {
  const content = paragraph.getTextContent();
  if (content !== '') {
    const targetText = target.getTextContent();
    if (targetText !== '' && !/\s$/.test(targetText) && !/^\s/.test(content)) {
      target.append($createTextNode(' '));
    }
    for (const child of paragraph.getChildren()) target.append(child);
  }
  paragraph.remove();
}

/** Turns a soft break into a paragraph break: the content after it moves to a new paragraph. */
function $splitParagraphAt(lineBreak: LineBreakNode, paragraph: ParagraphNode): void {
  const rest = $createParagraphNode();
  let sibling = lineBreak.getNextSibling();
  while (sibling) {
    const next = sibling.getNextSibling();
    rest.append(sibling);
    sibling = next;
  }
  lineBreak.remove();
  paragraph.insertAfter(rest);
}

/**
 * Joins the lines in the selection into one paragraph. Soft breaks and the
 * paragraph breaks between selected paragraphs become a single space each,
 * unless there is already a space at that point. A soft break right after the
 * selection becomes a paragraph break, so the joined text stands on its own.
 */
export function $joinSelectedLines(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;

  const paragraphs = $paragraphsInSelection(selection);
  const nodes = selection.getNodes();
  const lineBreaks = nodes.filter($isLineBreakNode);
  if (paragraphs.length < 2 && lineBreaks.length === 0) return false;

  const last = nodes[nodes.length - 1];
  const breakAfter = last?.getNextSibling();
  const trailingBreak = $isLineBreakNode(breakAfter) ? breakAfter : null;

  for (const lineBreak of lineBreaks) $replaceBreakWithSpace(lineBreak);

  const [target, ...rest] = paragraphs;
  if (!target) return false;
  for (const paragraph of rest) $appendParagraph(target, paragraph);

  if (trailingBreak?.isAttached()) {
    const paragraph = trailingBreak.getParent();
    if ($isParagraphNode(paragraph)) $splitParagraphAt(trailingBreak, paragraph);
  }
  target.selectEnd();
  return true;
}
