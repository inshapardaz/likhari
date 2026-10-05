import type { ElementNode } from 'lexical';
import { $textGroups, $locate, type FindMatch } from '../find/findReplaceActions';
import { wordsIn, type Speller } from './spellDictionaries';

/** The checker for each text direction: English for LTR blocks, Urdu for RTL. */
export interface Checkers {
  ltr?: Speller;
  rtl?: Speller;
}

/** The part of a misspelled word that falls inside one text node. */
export interface Segment {
  key: string;
  start: number;
  end: number;
}

export interface Misspelling {
  word: string;
  match: FindMatch;
  segments: Segment[];
}

/** Every word in the document its block's checker does not recognise. */
export function $collectMisspellings(checkers: Checkers): Misspelling[] {
  const found: Misspelling[] = [];
  for (const group of $textGroups()) {
    const direction = group[0].getParentOrThrow().getDirection();
    const speller = direction === 'rtl' ? checkers.rtl : checkers.ltr;
    if (!speller) continue;
    const text = group.map((node) => node.getTextContent()).join('');
    for (const span of wordsIn(text)) {
      if (speller.correct(span.word)) continue;
      const start = $locate(group, span.start, false);
      const end = $locate(group, span.end, true);
      found.push({
        word: span.word,
        match: { anchorKey: start.key, anchorOffset: start.offset, focusKey: end.key, focusOffset: end.offset },
        segments: segmentsOf(group, span.start, span.end),
      });
    }
  }
  return found;
}

function segmentsOf(group: ReturnType<typeof $textGroups>[number], start: number, end: number): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;
  for (const node of group) {
    const length = node.getTextContent().length;
    const from = Math.max(start, offset);
    const to = Math.min(end, offset + length);
    if (to > from) segments.push({ key: node.getKey(), start: from - offset, end: to - offset });
    offset += length;
  }
  return segments;
}

/** A misspelled word inside a block, as offsets into the block's text. */
export interface BlockMisspelling {
  start: number;
  end: number;
  word: string;
}

/**
 * The misspelled words inside one top-level block (a paragraph, a table, a list...),
 * as offsets into the block's text. Words are found per parent (paragraph or cell),
 * so text in different cells never forms one word. Must run inside an editor read.
 */
export function $misspellingsInBlock(block: ElementNode, checkers: Checkers): BlockMisspelling[] {
  const nodes = block.getAllTextNodes();
  const starts: number[] = [];
  let offset = 0;
  for (const node of nodes) {
    starts.push(offset);
    offset += node.getTextContent().length;
  }

  const found: BlockMisspelling[] = [];
  let i = 0;
  while (i < nodes.length) {
    const parent = nodes[i].getParentOrThrow();
    let j = i;
    let text = '';
    while (j < nodes.length && nodes[j].getParentOrThrow().getKey() === parent.getKey()) {
      text += nodes[j].getTextContent();
      j += 1;
    }
    const speller = parent.getDirection() === 'rtl' ? checkers.rtl : checkers.ltr;
    if (speller) {
      for (const span of wordsIn(text)) {
        if (!speller.correct(span.word)) {
          found.push({ start: starts[i] + span.start, end: starts[i] + span.end, word: span.word });
        }
      }
    }
    i = j;
  }
  return found;
}
