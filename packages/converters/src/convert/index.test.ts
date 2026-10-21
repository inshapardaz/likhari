import { describe, expect, it } from 'vitest';
import { cleanState, convertContent, convertContentToState } from './index';
import { FormatRegistry } from '../registry';
import { lexicalJsonConverter } from '../lexical-json';
import { markdownConverter } from '../markdown';
import { elementBase, makeState, paragraph, textNode, type SNode } from '../shared/serialized';
import type { FormatId } from '../types';

const FORMATS: FormatId[] = ['markdown', 'html', 'plain-text', 'lexical-json'];
const blocksOf = (state: unknown) => (state as { root: { children: SNode[] } }).root.children;
const texts = (block: SNode) => (block.children ?? []).map((c) => c.text);
const json = (...blocks: SNode[]) => lexicalJsonConverter.serialize(makeState(blocks));

describe('convertContent', () => {
  const doc = '# Title\n\nSome **bold** and *italic* text with a [link](https://example.com).\n\n- one\n- two\n';

  it('converts Markdown to HTML, plain text and Lexical JSON', () => {
    expect(convertContent(doc, { inputFormat: 'markdown', outputFormat: 'html' })).toContain('<h1>Title</h1>');
    expect(convertContent(doc, { inputFormat: 'markdown', outputFormat: 'plain-text' })).toBe(
      'Title\n\nSome bold and italic text with a link.\n\n- one\n- two',
    );
    expect(JSON.parse(convertContent(doc, { inputFormat: 'markdown', outputFormat: 'lexical-json' })).root.children).toHaveLength(3);
  });

  it('converts Lexical JSON and HTML to Markdown', () => {
    const lexical = json(elementBase('heading', [textNode('Hello')], { tag: 'h2' }), paragraph([textNode('plain '), textNode('bold', 1)]));
    expect(convertContent(lexical, { inputFormat: 'lexical-json', outputFormat: 'markdown' })).toBe('## Hello\n\nplain **bold**\n');
    expect(convertContent('<h2>Hello</h2><p>plain <strong>bold</strong></p>', { inputFormat: 'html', outputFormat: 'markdown' })).toBe(
      '## Hello\n\nplain **bold**\n',
    );
  });

  it('converts plain text to the others, a blank line separating paragraphs', () => {
    expect(convertContent('one\n\ntwo', { inputFormat: 'plain-text', outputFormat: 'markdown' })).toBe('one\n\ntwo\n');
    expect(convertContent('one\ntwo', { inputFormat: 'plain-text', outputFormat: 'html' })).toBe('<p dir="ltr">one<br>two</p>');
  });

  describe.each(FORMATS)('from %s', (from) => {
    // The same document in each format, then converted to every format: the words must survive.
    const source = () => {
      const lexical = json(
        elementBase('heading', [textNode('Heading')], { tag: 'h1' }),
        paragraph([textNode('First paragraph, with words.')]),
        paragraph([textNode('اردو متن ہے۔')], { direction: 'rtl' }),
      );
      return from === 'lexical-json' ? lexical : convertContent(lexical, { inputFormat: 'lexical-json', outputFormat: from });
    };

    it.each(FORMATS)('to %s keeps the text', (to) => {
      const out = convertContent(source(), { inputFormat: from, outputFormat: to });
      for (const word of ['Heading', 'First paragraph, with words.', 'اردو متن ہے۔']) expect(out).toContain(word);
    });
  });

  it('round-trips a document through another format and back, unchanged', () => {
    for (const via of ['lexical-json', 'html'] as const) {
      const there = convertContent(doc, { inputFormat: 'markdown', outputFormat: via });
      expect(convertContent(there, { inputFormat: via, outputFormat: 'markdown' }), via).toBe(doc);
    }
  });

  it('converts a format to itself, as a tidy-up', () => {
    expect(convertContent('Too   many    spaces  \n', { inputFormat: 'markdown', outputFormat: 'markdown' })).toBe('Too many spaces\n');
  });

  it('keeps the page-break and empty-ending markers in Markdown', () => {
    const md = 'one\n\n::pagebreak\n\ntwo\n\n::blank\n';
    expect(convertContent(md, { inputFormat: 'markdown', outputFormat: 'markdown' })).toBe(md);
    expect(convertContent(md, { inputFormat: 'markdown', outputFormat: 'html' })).toContain('data-likhari-page-break');
  });

  it('passes the context to the serializer', () => {
    const out = convertContent('![alt](a.png)', { inputFormat: 'markdown', outputFormat: 'html', context: { resolveImageUrl: (s) => `https://cdn.test/${s}` } });
    expect(out).toContain('https://cdn.test/a.png');
  });

  it('uses the registry it is given', () => {
    const registry = new FormatRegistry([markdownConverter, lexicalJsonConverter]);
    expect(convertContent('hi', { inputFormat: 'markdown', outputFormat: 'lexical-json', registry })).toContain('"hi"');
    expect(() => convertContent('hi', { inputFormat: 'markdown', outputFormat: 'html', registry })).toThrow(/no converter registered for format "html"/);
  });

  it('says when the input cannot be read, and which format it expected', () => {
    expect(() => convertContent('{not json', { inputFormat: 'lexical-json', outputFormat: 'markdown' })).toThrow(
      /convertContent: the input is not valid lexical-json/,
    );
  });

  it('converts empty input to an empty document', () => {
    expect(convertContent('', { inputFormat: 'markdown', outputFormat: 'plain-text' })).toBe('');
    expect(convertContent('', { inputFormat: 'markdown', outputFormat: 'markdown' })).toBe('');
  });

  describe('clean', () => {
    const messy = json(paragraph([textNode('  Hello   world  ')]));

    it('is on by default', () => {
      expect(convertContent(messy, { inputFormat: 'lexical-json', outputFormat: 'plain-text' })).toBe('Hello world');
    });

    it('can be turned off to convert exactly what is there', () => {
      expect(convertContent(messy, { inputFormat: 'lexical-json', outputFormat: 'plain-text', clean: false })).toBe('  Hello   world  ');
    });

    it('applies whatever the input format', () => {
      expect(convertContent('<p>a    b</p>', { inputFormat: 'html', outputFormat: 'plain-text' })).toBe('a b');
      expect(convertContent('a    b', { inputFormat: 'plain-text', outputFormat: 'plain-text' })).toBe('a b');
    });

    it('convertContentToState returns the cleaned state', () => {
      expect(texts(blocksOf(convertContentToState(messy, { inputFormat: 'lexical-json' }))[0])).toEqual(['Hello world']);
      expect(texts(blocksOf(convertContentToState(messy, { inputFormat: 'lexical-json', clean: false }))[0])).toEqual(['  Hello   world  ']);
    });
  });
});

describe('cleanState', () => {
  const clean = (...blocks: SNode[]) => blocksOf(cleanState(makeState(blocks)));

  it('normalises Unicode to NFC, composing Arabic-script letters stored as separate code points', () => {
    const [p] = clean(paragraph([textNode('é آ')]));
    expect(texts(p)).toEqual(['é آ']);
  });

  it('collapses runs of spaces and tabs to one space', () => {
    expect(texts(clean(paragraph([textNode('a  \t b\t\tc')]))[0])).toEqual(['a b c']);
  });

  it('trims stray spaces at the start and end of a block, not inside it', () => {
    expect(texts(clean(paragraph([textNode('  keep inner  gap  ')]))[0])).toEqual(['keep inner gap']);
  });

  it('collapses a space split across formatted runs', () => {
    const [p] = clean(paragraph([textNode('one ', 0), textNode(' two', 1), textNode(' ', 0), textNode(' three', 2)]));
    expect((p.children ?? []).map((c) => [c.text, c.format])).toEqual([['one ', 0], ['two', 1], [' ', 0], ['three', 2]]);
  });

  it('merges neighbouring runs that look the same, and keeps different ones apart', () => {
    const [p] = clean(paragraph([textNode('a', 1), textNode('b', 1), textNode('c', 0), textNode('d', 1)]));
    expect((p.children ?? []).map((c) => [c.text, c.format])).toEqual([['ab', 1], ['c', 0], ['d', 1]]);
  });

  it('removes runs that end up empty, leaving an empty paragraph as it was', () => {
    const [p, q] = clean(paragraph([textNode('   ')]), paragraph());
    expect(p.children).toEqual([]);
    expect(q.children).toEqual([]);
  });

  it('keeps empty paragraphs: they may be an end-of-page marker', () => {
    expect(clean(paragraph([textNode('a')]), paragraph(), paragraph()).map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
  });

  it('leaves code text exactly as written', () => {
    const [p] = clean(paragraph([textNode('  keep   this  ', 16)]));
    expect(texts(p)).toEqual(['  keep   this  ']);
  });

  it('keeps line breaks, and a space after one is a stray leading space', () => {
    const [p] = clean(paragraph([textNode('a  '), { type: 'linebreak', version: 1 }, textNode('  b')]));
    expect((p.children ?? []).map((c) => c.type === 'linebreak' ? '\n' : c.text)).toEqual(['a', '\n', 'b']);
  });

  it('cleans inside links, and a space doubled across a link edge becomes one', () => {
    const link = elementBase('link', [textNode(' a   b ')], { url: 'https://x.test' });
    const [p] = clean(paragraph([textNode('see '), link, textNode(' now')]));
    const [before, cleanedLink, after] = p.children ?? [];
    // the space after "see" and the one at the start of the link were a double space; the link keeps its inner gap
    expect([before.text, cleanedLink.children![0].text, after.text]).toEqual(['see ', 'a b ', 'now']);
  });

  it('reaches text in lists, nested lists, tables, quotes and footnotes', () => {
    const item = (text: string, nested?: SNode) => elementBase('listitem', [textNode(text), ...(nested ? [nested] : [])], { value: 1 });
    const list = elementBase('list', [item(' outer  one ', elementBase('list', [item(' inner  one ')], { listType: 'bullet', start: 1, tag: 'ul' }))], { listType: 'bullet', start: 1, tag: 'ul' });
    const table = elementBase('table', [elementBase('tablerow', [elementBase('tablecell', [paragraph([textNode(' a  b ')])], { colSpan: 1, rowSpan: 1, headerState: 0 })])]);
    const quote = elementBase('quote', [textNode(' q  q ')]);
    const notes = elementBase('footnote-list', [elementBase('footnote-item', [paragraph([textNode(' n  n ')])], { footnoteId: 'x' })]);
    const out = JSON.stringify(cleanState(makeState([list, table, quote, notes])));
    for (const tidy of ['"outer one"', '"inner one"', '"a b"', '"q q"', '"n n"']) expect(out).toContain(tidy);
    expect(out).not.toMatch(/"text":" |"text":"[^"]* "/); // no run starts or ends with a space
  });

  it('does not change structure: types, attributes and non-text nodes survive', () => {
    const image = { type: 'image', version: 1, src: 'a.png', altText: 'x', caption: null, linkType: 'linked', width: null, height: null };
    const before = makeState([elementBase('heading', [textNode(' T ')], { tag: 'h3' }), image as SNode, { type: 'page-break', version: 1 }, paragraph([textNode('a')], { direction: 'rtl', format: 'center', indent: 2 })]);
    const after = cleanState(structuredClone(before));
    expect(blocksOf(after).map((b) => b.type)).toEqual(['heading', 'image', 'page-break', 'paragraph']);
    expect(blocksOf(after)[0]).toMatchObject({ tag: 'h3' });
    expect(blocksOf(after)[1]).toEqual(image);
    expect(blocksOf(after)[3]).toMatchObject({ direction: 'rtl', format: 'center', indent: 2 });
  });

  it('is idempotent', () => {
    const once = cleanState(makeState([paragraph([textNode('  a   b ', 1), textNode(' c ', 0)])]));
    expect(cleanState(structuredClone(once))).toEqual(once);
  });

  it('leaves an already tidy document exactly as it was', () => {
    const tidy = makeState([paragraph([textNode('fine', 1), textNode(' text.', 0)])]);
    expect(cleanState(structuredClone(tidy))).toEqual(tidy);
  });
});
