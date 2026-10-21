import { isEmptyParagraph, textNode, type SNode } from '../shared/serialized';

/** Marks that end a sentence, in Urdu and Latin script: ۔ ؟ ! ? . … and the CJK full stop. */
const SENTENCE_END = /[۔؟!?.…。]/;
/** Closing quotes and brackets that may follow the mark and still end the sentence: ” ’ " ' ) ] » */
const CLOSERS = /[”’"')\]»]+$/;

/** The text of a block, from its text nodes only. */
function plainText(node: SNode): string {
  if (node.type === 'text') return String(node.text ?? '');
  if (node.type === 'linebreak') return '\n';
  return (node.children ?? []).map(plainText).join('');
}

/**
 * Whether a block's text stops mid-sentence: it does not end in a sentence mark (once any
 * closing quote or bracket is set aside). A comma, colon, semicolon, dash or a plain word all
 * count as unfinished. A block with no text at all counts as finished.
 */
export function endsMidSentence(block: SNode): boolean {
  const text = plainText(block).trimEnd().replace(CLOSERS, '').trimEnd();
  return text !== '' && !SENTENCE_END.test(text.charAt(text.length - 1));
}

/** The alignment a paragraph effectively has: '' and 'start' are the same thing. */
const alignment = (block: SNode) => (block.format === '' || block.format == null ? 'start' : String(block.format));

/**
 * Whether two blocks could be one paragraph: both are plain paragraphs, the second is not
 * indented (an indent starts a new paragraph) and has text, and they agree on text direction
 * and alignment. A direction left unset on either side is compatible with anything.
 */
export function canJoinParagraphs(previous: SNode | undefined, next: SNode | undefined): boolean {
  if (!previous || !next || previous.type !== 'paragraph' || next.type !== 'paragraph') return false;
  if (plainText(next).trim() === '' || plainText(previous).trim() === '') return false;
  if (Number(next.indent ?? 0) > 0) return false;
  if (previous.direction && next.direction && previous.direction !== next.direction) return false;
  return alignment(previous) === alignment(next);
}

/**
 * Whether a page's text ends with an empty line, which marks the end of a paragraph: a trailing
 * empty paragraph in the parsed page (Markdown writes one as `::blank`). Markdown written by hand
 * may instead just end with a blank line (`\n\n`, not only a final newline), which the parser
 * would drop, so for Markdown the raw text is checked too.
 */
export function endsWithBlankLine(rawFormat: string, rawText: string, blocks: SNode[]): boolean {
  if (isEmptyParagraph(blocks[blocks.length - 1])) return true;
  return rawFormat === 'markdown' && /(\r?\n[ \t]*){2,}$/.test(rawText);
}

const startsWithSpace = (children: SNode[]) => /^\s/.test(plainText({ type: 'x', children: children.slice(0, 1) }));
const endsWithSpace = (children: SNode[]) => /\s$/.test(plainText({ type: 'x', children: children.slice(-1) }));

/** Appends `next`'s content to `previous` (which is changed), separated by one space unless one is already there. */
export function joinParagraphs(previous: SNode, next: SNode): void {
  const head = previous.children ?? [];
  const tail = next.children ?? [];
  const needsSpace = head.length > 0 && tail.length > 0 && !endsWithSpace(head) && !startsWithSpace(tail);
  previous.children = [...head, ...(needsSpace ? [textNode(' ')] : []), ...tail];
  // The merged paragraph keeps the first one's direction unless it had none.
  if (!previous.direction && next.direction) previous.direction = next.direction;
}
