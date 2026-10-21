import type { SerializedEditorState } from 'lexical';
import { defaultFormatRegistry, type FormatRegistry } from '../registry';
import type { ConverterContext, FormatId } from '../types';
import { elementBase, makeState, rootChildren, type SNode } from '../shared/serialized';

/** One page: its text, plus its format when that differs from `MergePagesOptions.inputFormat`. */
export type PageInput = string | { content: string; format?: FormatId };

export interface MergePagesOptions {
  /** The format of every page given as a bare string. Defaults to 'markdown'. */
  inputFormat?: FormatId;
  /** The format of the combined document. */
  outputFormat: FormatId;
  /** Passed to every parse and to the final serialize (image URL resolver and the like). */
  context?: ConverterContext;
  /** Defaults to the registry with all four built-in formats. */
  registry?: FormatRegistry;
}

/** Parses each page and returns the combined document as Lexical state, without serializing it. */
export function mergePagesToState(pages: PageInput[], options: Omit<MergePagesOptions, 'outputFormat'> = {}): SerializedEditorState {
  const { inputFormat = 'markdown', context, registry = defaultFormatRegistry } = options;

  const body: SNode[] = [];
  const footnotes: SNode[] = [];
  const takenFootnoteIds = new Set<string>();

  pages.forEach((page, index) => {
    const { content, format = inputFormat } = typeof page === 'string' ? { content: page } : page;
    let blocks: SNode[];
    try {
      blocks = structuredClone(rootChildren(registry.parse(format, content, context)));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`mergePages: page ${index + 1} is not valid ${format}: ${reason}`);
    }

    // Each page brings its own footnote list; they are combined into one at the end.
    const pageLists = blocks.filter((block) => block.type === 'footnote-list');
    const pageBody = blocks.filter((block) => block.type !== 'footnote-list');
    uniquifyFootnoteIds([...pageBody, ...pageLists], takenFootnoteIds);
    for (const list of pageLists) footnotes.push(...(list.children ?? []));

    if (index > 0) body.push({ type: 'page-break', version: 1 });
    body.push(...pageBody);
  });

  return makeState(footnotes.length > 0 ? [...body, elementBase('footnote-list', footnotes)] : body);
}

/**
 * Merges pages (Markdown, Lexical JSON, or any other supported format) into one document,
 * with a page break between each pair of pages, in the requested output format. Needs no
 * editor or DOM, so it can run in a server, a worker or a build script.
 *
 * Footnote ids are only unique within a page, so a page whose footnote ids clash with an
 * earlier page's gets them renamed (`1` becomes `1-2`), in references and notes alike; the
 * notes of all pages end up in one list at the end of the document.
 */
export function mergePages(pages: PageInput[], options: MergePagesOptions): string {
  const registry = options.registry ?? defaultFormatRegistry;
  return registry.serialize(options.outputFormat, mergePagesToState(pages, options), options.context);
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
