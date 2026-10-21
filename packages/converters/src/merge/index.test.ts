import { describe, expect, it } from 'vitest';
import { mergePages, mergePagesToState } from './index';
import { lexicalJsonConverter } from '../lexical-json';
import { markdownConverter } from '../markdown';
import { makeState, paragraph, textNode, type SNode } from '../shared/serialized';

const blocksOf = (state: unknown) => (state as { root: { children: SNode[] } }).root.children;
const types = (state: unknown) => blocksOf(state).map((b) => b.type);

describe('mergePages', () => {
  it('joins Markdown pages with a page break between each pair', () => {
    expect(mergePages(['one', 'two', 'three'], { outputFormat: 'markdown' })).toBe('one\n\n::pagebreak\n\ntwo\n\n::pagebreak\n\nthree\n');
  });

  it('puts no break before the first page or after the last', () => {
    const state = mergePagesToState(['a', 'b']);
    expect(types(state)).toEqual(['paragraph', 'page-break', 'paragraph']);
  });

  it('returns a single page unchanged, with no break', () => {
    expect(types(mergePagesToState(['# Title\n\ntext']))).toEqual(['heading', 'paragraph']);
  });

  it('merges nothing into an empty document', () => {
    expect(mergePages([], { outputFormat: 'plain-text' })).toBe('');
    expect(types(mergePagesToState([]))).toEqual(['paragraph']);
  });

  it('accepts Lexical JSON pages', () => {
    const page = (text: string) => lexicalJsonConverter.serialize(makeState([paragraph([textNode(text)])]));
    const state = mergePagesToState([page('first'), page('second')], { inputFormat: 'lexical-json' });
    expect(types(state)).toEqual(['paragraph', 'page-break', 'paragraph']);
    expect(mergePages([page('first'), page('second')], { inputFormat: 'lexical-json', outputFormat: 'markdown' })).toContain('first\n\n::pagebreak\n\nsecond');
  });

  it('accepts a different format per page', () => {
    const json = lexicalJsonConverter.serialize(makeState([paragraph([textNode('from json')])]));
    const out = mergePages(['**from markdown**', { content: json, format: 'lexical-json' }], { outputFormat: 'markdown' });
    expect(out).toBe('**from markdown**\n\n::pagebreak\n\nfrom json\n');
  });

  it('writes the output format the caller asks for', () => {
    const pages = ['a', 'b'];
    expect(mergePages(pages, { outputFormat: 'html' })).toContain('<div data-likhari-page-break style="page-break-after: always"></div>');
    expect(JSON.parse(mergePages(pages, { outputFormat: 'lexical-json' })).root.children).toHaveLength(3);
    expect(mergePages(pages, { outputFormat: 'plain-text' })).toBe('a\n\n\n\nb');
  });

  it('keeps blank pages, so page numbers still line up', () => {
    expect(types(mergePagesToState(['a', '', 'c']))).toEqual(['paragraph', 'page-break', 'paragraph', 'page-break', 'paragraph']);
  });

  it('does not alter the Markdown of each page', () => {
    const page = '## Heading\n\n- [x] done\n\n| A | B |\n| - | - |\n| 1 | 2 |';
    const merged = mergePages([page, page], { outputFormat: 'markdown' });
    const single = markdownConverter.serialize(markdownConverter.parse(page));
    expect(merged).toBe(`${single}\n::pagebreak\n\n${single}`);
  });

  it('names the page that cannot be read', () => {
    expect(() => mergePages(['{not json'], { inputFormat: 'lexical-json', outputFormat: 'markdown' })).toThrow(/mergePages: page 1 is not valid lexical-json/);
    expect(() => mergePages([{ content: 'x' }, { content: '{nope', format: 'lexical-json' }], { outputFormat: 'markdown' })).toThrow(
      /mergePages: page 2 is not valid lexical-json/,
    );
  });

  it('does not mutate or share state between calls', () => {
    const a = mergePagesToState(['a']);
    const b = mergePagesToState(['a']);
    expect(a).toEqual(b);
    expect(blocksOf(a)[0]).not.toBe(blocksOf(b)[0]);
  });
});

describe('footnotes across pages', () => {
  const page = (note: string) => `claim[^1]\n\n[^1]: ${note}`;

  it('gathers every page\'s notes into one list at the end', () => {
    const state = mergePagesToState([page('first note'), 'plain page', page('second note')]);
    expect(types(state)).toEqual(['paragraph', 'page-break', 'paragraph', 'page-break', 'paragraph', 'footnote-list']);
    expect(blocksOf(state)[5].children).toHaveLength(2);
  });

  it('renames a clashing id so each reference still points at its own note', () => {
    const md = mergePages([page('first note'), page('second note')], { outputFormat: 'markdown' });
    expect(md).toContain('claim[^1]');
    expect(md).toContain('claim[^1-2]');
    expect(md).toContain('[^1]: first note');
    expect(md).toContain('[^1-2]: second note');
    expect(md.indexOf('first note')).toBeGreaterThan(md.indexOf('::pagebreak'));
  });

  it('leaves ids that do not clash alone', () => {
    const md = mergePages(['a[^x]\n\n[^x]: X', 'b[^y]\n\n[^y]: Y'], { outputFormat: 'markdown' });
    expect(md).toContain('[^x]: X');
    expect(md).toContain('[^y]: Y');
  });

  it('numbers footnotes through the whole document in the plain-text output', () => {
    const text = mergePages([page('first note'), page('second note')], { outputFormat: 'plain-text' });
    expect(text).toContain('claim[1]');
    expect(text).toContain('claim[2]');
    expect(text).toMatch(/\[1\] first note\n\[2\] second note$/);
  });
});
