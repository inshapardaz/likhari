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

  describe('skipBlankPages', () => {
    const skip = (pages: Parameters<typeof mergePagesToState>[0]) => types(mergePagesToState(pages, { skipBlankPages: true }));

    it('drops empty and whitespace-only pages without leaving a stray break', () => {
      expect(skip(['a', '', '   \n\n  ', 'c'])).toEqual(['paragraph', 'page-break', 'paragraph']);
    });

    it('does not put a break before the first kept page or after the last', () => {
      expect(skip(['', 'a', ''])).toEqual(['paragraph']);
    });

    it('gives an empty document when every page is blank', () => {
      expect(skip(['', ' '])).toEqual(['paragraph']);
      expect(mergePages(['', ' '], { skipBlankPages: true, outputFormat: 'plain-text' })).toBe('');
    });

    it('treats a Lexical JSON page of one empty paragraph as blank', () => {
      const blank = lexicalJsonConverter.serialize(makeState([paragraph()]));
      const full = lexicalJsonConverter.serialize(makeState([paragraph([textNode('text')])]));
      expect(types(mergePagesToState([full, blank, full], { inputFormat: 'lexical-json', skipBlankPages: true }))).toEqual(['paragraph', 'page-break', 'paragraph']);
    });

    it('keeps a page that has only a rule, an image or a page break', () => {
      expect(skip(['a', '---', 'b'])).toEqual(['paragraph', 'page-break', 'horizontalrule', 'page-break', 'paragraph']);
      expect(skip(['::pagebreak'])).toContain('page-break');
    });

    it('keeps blank pages unless asked', () => {
      expect(types(mergePagesToState(['a', '', 'c']))).toHaveLength(5);
    });
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

describe("joinParagraphs: 'punctuation'", () => {
  const join = { joinParagraphs: 'punctuation' } as const;
  const merged = (pages: Parameters<typeof mergePagesToState>[0], options: Parameters<typeof mergePagesToState>[1] = join) =>
    mergePages(pages, { outputFormat: 'markdown', ...options });

  it('is off by default: an unfinished page still gets a break', () => {
    expect(types(mergePagesToState(['the sentence goes', 'on here.']))).toEqual(['paragraph', 'page-break', 'paragraph']);
  });

  it('joins a page that stops mid-sentence onto the next, with no break between', () => {
    expect(merged(['the sentence goes', 'on here.'])).toBe('the sentence goes on here.\n');
  });

  it('starts a new paragraph, with a break, after a finished sentence', () => {
    expect(merged(['It ended.', 'A new one.'])).toBe('It ended.\n\n::pagebreak\n\nA new one.\n');
  });

  it('works for Urdu full stops and question marks', () => {
    expect(merged(['یہ جملہ ختم ہوا۔', 'نیا جملہ'])).toContain('::pagebreak');
    expect(merged(['کیا یہ ختم ہوا؟', 'نیا جملہ'])).toContain('::pagebreak');
    expect(merged(['یہ جملہ ابھی', 'جاری ہے۔'])).toBe('یہ جملہ ابھی جاری ہے۔\n');
  });

  it('only joins the first paragraph of the next page; the rest follow as normal blocks', () => {
    expect(merged(['one two', 'three\n\nfour.\n\nfive.'])).toBe('one two three\n\nfour.\n\nfive.\n');
  });

  it('chains through a page that is one unfinished paragraph', () => {
    const state = mergePagesToState(['start of a', 'long sentence that', 'finally ends.'], join);
    expect(types(state)).toEqual(['paragraph']);
    expect(merged(['start of a', 'long sentence that', 'finally ends.'])).toBe('start of a long sentence that finally ends.\n');
  });

  it('decides each boundary on its own', () => {
    const state = mergePagesToState(['half a', 'sentence.', 'next page', 'goes on'], join);
    expect(types(state)).toEqual(['paragraph', 'page-break', 'paragraph']);
    expect(merged(['half a', 'sentence.', 'next page', 'goes on'])).toBe('half a sentence.\n\n::pagebreak\n\nnext page goes on\n');
  });

  it('does not join into or out of headings, lists, quotes or an indented paragraph', () => {
    expect(types(mergePagesToState(['# Heading', 'text'], join))).toEqual(['heading', 'page-break', 'paragraph']);
    expect(types(mergePagesToState(['unfinished', '# Heading'], join))).toEqual(['paragraph', 'page-break', 'heading']);
    expect(types(mergePagesToState(['unfinished', '- item'], join))).toEqual(['paragraph', 'page-break', 'list']);
    expect(types(mergePagesToState(['> quoted', 'text'], join))).toEqual(['quote', 'page-break', 'paragraph']);
    const indented = lexicalJsonConverter.serialize(makeState([paragraph([textNode('indented')], { indent: 1 })]));
    expect(types(mergePagesToState(['unfinished', { content: indented, format: 'lexical-json' }], join))).toEqual(['paragraph', 'page-break', 'paragraph']);
  });

  it('does not join across a change of direction or alignment', () => {
    const rtl = lexicalJsonConverter.serialize(makeState([paragraph([textNode('اردو')], { direction: 'rtl' })]));
    const ltr = lexicalJsonConverter.serialize(makeState([paragraph([textNode('english')], { direction: 'ltr' })]));
    expect(types(mergePagesToState([{ content: ltr, format: 'lexical-json' }, { content: rtl, format: 'lexical-json' }], join))).toContain('page-break');
    expect(types(mergePagesToState(['unfinished', ':::para{align="center"}\ntext\n:::'], join))).toContain('page-break');
  });

  it('keeps formatting at the seam', () => {
    const state = mergePagesToState(['plain **bold**', '*italic* end.'], join);
    const children = blocksOf(state)[0].children!;
    expect(children.map((c) => [c.text, c.format])).toEqual([['plain ', 0], ['bold', 1], [' ', 0], ['italic', 2], [' end.', 0]]);
  });

  it('joins across Lexical JSON pages', () => {
    const page = (text: string) => lexicalJsonConverter.serialize(makeState([paragraph([textNode(text)])]));
    expect(mergePages([page('half a'), page('sentence.')], { inputFormat: 'lexical-json', joinParagraphs: 'punctuation', outputFormat: 'plain-text' })).toBe('half a sentence.');
  });

  it('does not join onto a blank page, and a skipped blank page does not hide a continuation', () => {
    expect(types(mergePagesToState(['unfinished', '', 'later'], join))).toEqual(['paragraph', 'page-break', 'paragraph', 'page-break', 'paragraph']);
    expect(types(mergePagesToState(['unfinished', '', 'later'], { ...join, skipBlankPages: true }))).toEqual(['paragraph']);
  });

  it('produces the same joined text in every output format', () => {
    const pages = ['half a', 'sentence.'];
    expect(mergePages(pages, { ...join, outputFormat: 'plain-text' })).toBe('half a sentence.');
    expect(mergePages(pages, { ...join, outputFormat: 'html' })).toBe('<p>half a sentence.</p>');
    expect(JSON.parse(mergePages(pages, { ...join, outputFormat: 'lexical-json' })).root.children).toHaveLength(1);
  });

  it('still gathers footnotes from joined pages into the one list', () => {
    const state = mergePagesToState(['half a[^1]\n\n[^1]: one', 'sentence[^1].\n\n[^1]: two'], join);
    expect(types(state)).toEqual(['paragraph', 'footnote-list']);
    expect(blocksOf(state)[1].children).toHaveLength(2);
    expect(mergePages(['half a[^1]\n\n[^1]: one', 'sentence[^1].\n\n[^1]: two'], { ...join, outputFormat: 'markdown' })).toContain('[^1-2]');
  });
});

describe("joinParagraphs: 'blank-line'", () => {
  const join = { joinParagraphs: 'blank-line' } as const;
  const merged = (pages: Parameters<typeof mergePagesToState>[0], extra: Parameters<typeof mergePagesToState>[1] = {}) =>
    mergePages(pages, { outputFormat: 'markdown', ...join, ...extra });
  const json = (...blocks: SNode[]) => ({ content: lexicalJsonConverter.serialize(makeState(blocks)), format: 'lexical-json' as const });
  const p = (text: string) => paragraph([textNode(text)]);

  describe('Markdown pages (read from the raw text)', () => {
    it('a page that ends with a blank line ends its paragraph: the next page starts a new one, with a break', () => {
      expect(merged(['first page\n\n', 'second page'])).toBe('first page\n\n::pagebreak\n\nsecond page\n');
    });

    it('a page without a blank line at the end continues, even after a full stop', () => {
      expect(merged(['finished sentence.', 'carried on'])).toBe('finished sentence. carried on\n');
      expect(merged(['finished sentence.\n', 'carried on'])).toBe('finished sentence. carried on\n');
    });

    it('a single final newline is not a blank line', () => {
      expect(types(mergePagesToState(['a\n', 'b'], join))).toEqual(['paragraph']);
    });

    it('more than one blank line, spaces on the blank line and Windows line endings all count', () => {
      for (const ending of ['\n\n\n\n', '\n  \n', '\r\n\r\n', '\n\t\n']) {
        expect(types(mergePagesToState([`a${ending}`, 'b'], join)), JSON.stringify(ending)).toEqual(['paragraph', 'page-break', 'paragraph']);
      }
    });

    it('decides each page boundary on its own', () => {
      expect(merged(['one\n\n', 'two', 'three\n\n', 'four'])).toBe('one\n\n::pagebreak\n\ntwo three\n\n::pagebreak\n\nfour\n');
    });

    it('chains through unmarked pages', () => {
      expect(merged(['a', 'b', 'c'])).toBe('a b c\n');
    });
  });

  describe('other formats (read from a trailing empty paragraph)', () => {
    it('Lexical JSON: a trailing empty paragraph ends the paragraph, none continues', () => {
      expect(types(mergePagesToState([json(p('a'), paragraph()), json(p('b'))], join))).toEqual(['paragraph', 'page-break', 'paragraph']);
      expect(types(mergePagesToState([json(p('a')), json(p('b'))], join))).toEqual(['paragraph']);
    });

    it('HTML: <p></p> and <p><br></p> at the end are both the marker', () => {
      for (const marker of ['<p></p>', '<p><br></p>']) {
        const out = mergePagesToState([{ content: `<p>a</p>${marker}`, format: 'html' }, { content: '<p>b</p>', format: 'html' }], join);
        expect(types(out), marker).toEqual(['paragraph', 'page-break', 'paragraph']);
      }
    });

    it('plain text: a blank line at the end is the marker', () => {
      expect(types(mergePagesToState([{ content: 'a\n\n', format: 'plain-text' }, { content: 'b', format: 'plain-text' }], join))).toContain('page-break');
      expect(types(mergePagesToState([{ content: 'a', format: 'plain-text' }, { content: 'b', format: 'plain-text' }], join))).toEqual(['paragraph']);
    });

    it('only the end of the page counts, not an empty paragraph in the middle', () => {
      expect(types(mergePagesToState([json(p('a'), paragraph(), p('b')), json(p('c'))], join))).toEqual(['paragraph', 'paragraph', 'paragraph']);
      expect(merged([json(p('a'), paragraph(), p('b')), json(p('c'))])).toContain('b c');
    });

    it('several trailing empty paragraphs count once', () => {
      expect(types(mergePagesToState([json(p('a'), paragraph(), paragraph()), json(p('b'))], join))).toEqual(['paragraph', 'page-break', 'paragraph']);
    });
  });

  it('removes the marker from the output', () => {
    const out = mergePagesToState([json(p('a'), paragraph()), json(p('b'), paragraph())], join);
    expect(types(out)).toEqual(['paragraph', 'page-break', 'paragraph']);
    expect(merged(['a\n\n', 'b\n\n'])).toBe('a\n\n::pagebreak\n\nb\n');
  });

  it('keeps empty paragraphs when the mode is off', () => {
    expect(types(mergePagesToState([json(p('a'), paragraph()), json(p('b'))]))).toEqual(['paragraph', 'paragraph', 'page-break', 'paragraph']);
  });

  it('never joins across a heading, list, quote, indent, or direction/alignment change, marker or not', () => {
    expect(types(mergePagesToState(['# Heading', 'text'], join))).toEqual(['heading', 'page-break', 'paragraph']);
    expect(types(mergePagesToState(['text', '# Heading'], join))).toEqual(['paragraph', 'page-break', 'heading']);
    expect(types(mergePagesToState(['text', '- item'], join))).toEqual(['paragraph', 'page-break', 'list']);
    expect(types(mergePagesToState(['text', json(paragraph([textNode('x')], { indent: 1 }))], join))).toEqual(['paragraph', 'page-break', 'paragraph']);
    expect(types(mergePagesToState([json(paragraph([textNode('a')], { direction: 'ltr' })), json(paragraph([textNode('ب')], { direction: 'rtl' }))], join))).toContain('page-break');
  });

  it('a blank page is not a marker for the page before it, and a skipped one does not hide a continuation', () => {
    expect(types(mergePagesToState(['a', '\n\n', 'b'], join))).toEqual(['paragraph', 'page-break', 'paragraph', 'page-break', 'paragraph']);
    expect(types(mergePagesToState(['a', '\n\n', 'b'], { ...join, skipBlankPages: true }))).toEqual(['paragraph']);
  });

  it('joins Urdu pages the same way', () => {
    expect(merged(['یہ جملہ ابھی', 'جاری ہے۔'])).toBe('یہ جملہ ابھی جاری ہے۔\n');
    expect(merged(['یہ جملہ ختم ہوا۔\n\n', 'نیا پیراگراف'])).toContain('::pagebreak');
  });

  it('writes the joined text in every output format', () => {
    const pages = ['half a', 'sentence.'];
    expect(mergePages(pages, { ...join, outputFormat: 'plain-text' })).toBe('half a sentence.');
    expect(mergePages(pages, { ...join, outputFormat: 'html' })).toBe('<p>half a sentence.</p>');
  });

  it('still gathers footnotes into one list, with the marker before them', () => {
    const state = mergePagesToState(['half a[^1]\n\n[^1]: one', 'sentence[^1].\n\n[^1]: two\n\n'], join);
    expect(types(state)).toEqual(['paragraph', 'footnote-list']);
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
