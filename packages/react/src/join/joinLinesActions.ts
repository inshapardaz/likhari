import {
  $createTextNode,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $createParagraphNode,
  type LexicalNode,
  type LineBreakNode,
  type ParagraphNode,
  type PointType,
  type RangeSelection,
  type TextNode,
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

/**
 * Text nodes in the selection that hold a literal newline. Lexical shows these
 * as line breaks, but they are not line-break nodes: content loaded from
 * plain text or a foreign Lexical document can be shaped this way.
 */
function $textNodesWithNewlines(selection: RangeSelection): TextNode[] {
  return selection.getNodes().filter((node): node is TextNode => $isTextNode(node) && node.getTextContent().includes('\n'));
}

export function $canJoinLines(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
  if ($paragraphsInSelection(selection).length > 1) return true;
  return selection.getNodes().some($isLineBreakNode) || $textNodesWithNewlines(selection).length > 0;
}

/** Replaces the newlines in the selected part of a text node, each by one space (none if one is already there). */
function $replaceNewlinesInText(node: TextNode, start: PointType, end: PointType): void {
  const text = node.getTextContent();
  const from = start.key === node.getKey() ? start.offset : 0;
  const to = end.key === node.getKey() ? end.offset : text.length;
  const joined = text.slice(from, to).replace(/[ \t]*\r?\n[ \t]*/g, ' ');
  node.setTextContent(text.slice(0, from) + joined + text.slice(to));
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

/** Moves `tail` into a new paragraph right after `paragraph`. A leading soft break is the
 * split point itself, so it is dropped rather than carried over as the new paragraph's first child. */
function $moveTailToNewParagraph(paragraph: ParagraphNode, tail: LexicalNode[]): void {
  if ($isLineBreakNode(tail[0])) {
    tail[0].remove();
    tail.shift();
  }
  if (tail.length === 0) return;
  const rest = $createParagraphNode();
  for (const node of tail) rest.append(node);
  paragraph.insertAfter(rest);
}

/**
 * Splits off whatever in `paragraph` comes after the selection's end point into a
 * paragraph of its own, so content the user didn't select isn't swept into the join
 * along with it — whether that's the rest of a partly-selected line, or the
 * paragraph's remaining soft-broken lines.
 */
function $splitUnselectedTail(paragraph: ParagraphNode, end: PointType): void {
  if (end.type === 'text') {
    const endNode = end.getNode();
    if (endNode.getTopLevelElement()?.getKey() !== paragraph.getKey()) return;
    const text = endNode.getTextContent();
    const tail: LexicalNode[] = [];
    if (end.offset === 0) {
      tail.push(endNode);
    } else if (end.offset < text.length) {
      endNode.setTextContent(text.slice(0, end.offset));
      tail.push($createTextNode(text.slice(end.offset)));
    }
    let sibling = endNode.getNextSibling();
    while (sibling) {
      const next = sibling.getNextSibling();
      tail.push(sibling);
      sibling = next;
    }
    $moveTailToNewParagraph(paragraph, tail);
  } else {
    const endNode = end.getNode();
    if (endNode.getKey() !== paragraph.getKey()) return;
    $moveTailToNewParagraph(paragraph, endNode.getChildren().slice(end.offset));
  }
}

/**
 * Joins the lines in the selection into one paragraph. Soft breaks and the
 * paragraph breaks between selected paragraphs become a single space each,
 * unless there is already a space at that point. Anything after the
 * selection's end point — the unselected rest of a partly-selected line, or
 * further soft-broken lines — splits off into its own paragraph, so it stands
 * apart from the text that was actually joined.
 */
export function $joinSelectedLines(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;

  const paragraphs = $paragraphsInSelection(selection);
  const nodes = selection.getNodes();
  const lineBreaks = nodes.filter($isLineBreakNode);
  const textsWithNewlines = $textNodesWithNewlines(selection);
  if (paragraphs.length < 2 && lineBreaks.length === 0 && textsWithNewlines.length === 0) return false;

  // RangeSelection's anchor/focus track drag direction, not document order (and
  // getStartEndPoints() returns them as-is, anchor first) — reorder them so "start"/"end"
  // below always mean "earlier"/"later" in the document, regardless of which way the user
  // dragged, or Shift+arrow'd, the selection. Getting this wrong silently skips the tail
  // split below (sweeping unselected content into the join) for any backward selection.
  const [start, end] = selection.isBackward() ? [selection.focus, selection.anchor] : [selection.anchor, selection.focus];

  for (const lineBreak of lineBreaks) $replaceBreakWithSpace(lineBreak);
  for (const textNode of textsWithNewlines) $replaceNewlinesInText(textNode, start, end);

  const [target, ...rest] = paragraphs;
  if (!target) return false;

  const lastParagraph = paragraphs[paragraphs.length - 1];
  $splitUnselectedTail(lastParagraph, end);
  for (const paragraph of rest) $appendParagraph(target, paragraph);

  // Keep the caret where the selection began, rather than at the end of everything
  // just joined — useful on its own, and essential when many lines were joined at
  // once, where "the end" could otherwise land far past where the user was working.
  start.getNode().select(start.offset, start.offset);
  return true;
}
