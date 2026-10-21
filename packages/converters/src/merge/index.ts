import type { SerializedEditorState } from 'lexical';
import { defaultFormatRegistry, type FormatRegistry } from '../registry';
import type { ConverterContext, FormatId } from '../types';
import { elementBase, isEmptyParagraph, makeState, rootChildren, type SNode } from '../shared/serialized';
import { canJoinParagraphs, endsMidSentence, endsWithBlankLine, joinParagraphs } from './continuation';

/** One page: its text, plus its format when that differs from `MergePagesOptions.inputFormat`. */
export type PageInput = string | { content: string; format?: FormatId };

export interface MergePagesOptions {
  /** The format of every page given as a bare string. Defaults to 'markdown'. */
  inputFormat?: FormatId;
  /** The format of the combined document. */
  outputFormat: FormatId;
  /** Leave out pages with no content: nothing, whitespace, or only empty paragraphs. Off by default. */
  skipBlankPages?: boolean;
  /**
   * Join pages that carry on the previous page's last paragraph into one paragraph, instead
   * of breaking the page. Off by default. Both modes only join when the next page opens with an
   * unindented paragraph of the same direction and alignment after a plain paragraph; headings,
   * lists, quotes, tables and blank pages never join.
   *
   * - `'blank-line'`: a page that ends with an empty line or empty paragraph ends its paragraph,
   *   so the next page starts a new one; a page that does not, continues. The marker is consumed,
   *   so it does not appear in the output. Markdown is read from the raw text (it must end with a
   *   blank line, `\n\n`), because Markdown has no empty paragraph; see the README.
   * - `'punctuation'`: a guess from the text. The page continues when its last paragraph does
   *   not end with `۔ ؟ ! ? . …` (closing quotes and brackets aside).
   *
   * A page break cannot sit inside a paragraph, so none is inserted where pages are joined.
   */
  joinParagraphs?: 'blank-line' | 'punctuation';
  /** Passed to every parse and to the final serialize (image URL resolver and the like). */
  context?: ConverterContext;
  /** Defaults to the registry with all four built-in formats. */
  registry?: FormatRegistry;
}

/** Parses each page and returns the combined document as Lexical state, without serializing it. */
export function mergePagesToState(pages: PageInput[], options: Omit<MergePagesOptions, 'outputFormat'> = {}): SerializedEditorState {
  const { inputFormat = 'markdown', skipBlankPages = false, joinParagraphs: joinMode, context, registry = defaultFormatRegistry } = options;

  const body: SNode[] = [];
  const footnotes: SNode[] = [];
  const takenFootnoteIds = new Set<string>();
  let kept = 0;
  let previousEndedParagraph = false;

  pages.forEach((page, index) => {
    const { content, format = inputFormat } = typeof page === 'string' ? { content: page } : page;
    let blocks: SNode[];
    try {
      blocks = structuredClone(rootChildren(registry.parse(format, content, context)));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`mergePages: page ${index + 1} is not valid ${format}: ${reason}`);
    }

    if (skipBlankPages && blocks.every(isBlank)) return;

    // Each page brings its own footnote list; they are combined into one at the end.
    const pageLists = blocks.filter((block) => block.type === 'footnote-list');
    const pageBody = blocks.filter((block) => block.type !== 'footnote-list');
    uniquifyFootnoteIds([...pageBody, ...pageLists], takenFootnoteIds);
    for (const list of pageLists) footnotes.push(...(list.children ?? []));

    const previous = body[body.length - 1];
    let continues = false;
    if (joinMode === 'punctuation') continues = !!previous && endsMidSentence(previous);
    if (joinMode === 'blank-line') {
      continues = !previousEndedParagraph;
      previousEndedParagraph = endsWithBlankLine(format, content, [...pageBody]);
      // The empty line only marks the end of the paragraph; it is not content to keep.
      if (pageBody.some((block) => !isEmptyParagraph(block))) {
        while (isEmptyParagraph(pageBody[pageBody.length - 1])) pageBody.pop();
      }
    }
    const joins = kept > 0 && continues && canJoinParagraphs(previous, pageBody[0]);
    if (joins) joinParagraphs(previous, pageBody.shift()!);
    else if (kept > 0) body.push({ type: 'page-break', version: 1 });
    kept += 1;
    body.push(...pageBody);
  });

  return makeState(footnotes.length > 0 ? [...body, elementBase('footnote-list', footnotes)] : body);
}

/**
 * Merges pages (Markdown, Lexical JSON, or any other supported format) into one document,
 * with a page break between each pair of pages, in the requested output format. Needs no
 * editor or DOM, so it can run in a server, a worker or a build script.
 *
 * With `skipBlankPages`, blank pages are left out and no break is added for them.
 *
 * Footnote ids are only unique within a page, so a page whose footnote ids clash with an
 * earlier page's gets them renamed (`1` becomes `1-2`), in references and notes alike; the
 * notes of all pages end up in one list at the end of the document.
 */
export function mergePages(pages: PageInput[], options: MergePagesOptions): string {
  const registry = options.registry ?? defaultFormatRegistry;
  return registry.serialize(options.outputFormat, mergePagesToState(pages, options), options.context);
}

/** A block with nothing in it: a paragraph holding only whitespace and line breaks. Anything else (an image, a rule, a table, a break) is content. */
function isBlank(block: SNode): boolean {
  if (block.type !== 'paragraph') return false;
  return (block.children ?? []).every((child) => (child.type === 'text' ? String(child.text ?? '').trim() === '' : child.type === 'linebreak'));
}

/** Renames this page's footnote ids that an earlier page already uses, then claims all its ids. */
function uniquifyFootnoteIds(blocks: SNode[], taken: Set<string>): void {
  const nodes: SNode[] = [];
  const collect = (node: SNode) => {
    if (typeof node.footnoteId === 'string') nodes.push(node);
    (node.children ?? []).forEach(collect);
  };
  blocks.forEach(collect);

  const renamed = new Map<string, string>();
  for (const node of nodes) {
    const id = node.footnoteId as string;
    if (!renamed.has(id)) {
      let next = id;
      for (let n = 2; taken.has(next); n += 1) next = `${id}-${n}`;
      renamed.set(id, next);
    }
    node.footnoteId = renamed.get(id);
  }
  renamed.forEach((id) => taken.add(id));
}
