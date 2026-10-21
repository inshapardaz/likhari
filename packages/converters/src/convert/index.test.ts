import { describe, expect, it } from 'vitest';
import { convertContent, convertContentToState } from './index';
import { FormatRegistry } from '../registry';
import { lexicalJsonConverter } from '../lexical-json';
import { markdownConverter } from '../markdown';
import { elementBase, makeState, paragraph, textNode, type SNode } from '../shared/serialized';
import type { FormatId } from '../types';

const FORMATS: FormatId[] = ['markdown', 'html', 'plain-text', 'lexical-json'];
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

  it('converts a format to itself, writing it the way the editor does', () => {
    expect(convertContent('Title\n=====\n\n* a\n* b\n', { inputFormat: 'markdown', outputFormat: 'markdown' })).toBe('# Title\n\n- a\n- b\n');
  });

  it('leaves the text exactly as it is: no spaces are collapsed, trimmed or normalised', () => {
    const lexical = json(paragraph([textNode('  Hello   world  ')]));
    expect(convertContent(lexical, { inputFormat: 'lexical-json', outputFormat: 'plain-text' })).toBe('  Hello   world  ');
    expect(convertContent('e\u0301', { inputFormat: 'plain-text', outputFormat: 'plain-text' })).toBe('e\u0301');
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

  it('convertContentToState returns the parsed document as Lexical state', () => {
    const state = convertContentToState('# Hi\n\ntext', { inputFormat: 'markdown' }) as unknown as { root: { children: { type: string }[] } };
    expect(state.root.children.map((b) => b.type)).toEqual(['heading', 'paragraph']);
  });
});
