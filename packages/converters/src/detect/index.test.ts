import { describe, expect, it } from 'vitest';
import { detectContentFormat, hasSemanticHtml } from './index';
import { lexicalJsonConverter } from '../lexical-json';
import { makeState, paragraph, textNode } from '../shared/serialized';

describe('detectContentFormat', () => {
  it('leaves prose, blank text and bare URLs as plain text', () => {
    for (const text of [
      '',
      '   \n',
      'Just a sentence, with a comma and 3 numbers.',
      'First line\nSecond line\n\nThird paragraph',
      'https://example.com/path?q=1',
      'In 2024. The year was long.',
      'Price is 5 * 3 = 15 and a*b',
      'snake_case_name and __init__',
      'یہ ایک اردو جملہ ہے۔\nدوسری سطر۔',
      'I <3 you and 2 < 3',
      'Email me at <someone@example.com>',
    ]) {
      expect(detectContentFormat(text), JSON.stringify(text)).toBeNull();
    }
  });

  it('recognises Lexical JSON by its root node', () => {
    const json = lexicalJsonConverter.serialize(makeState([paragraph([textNode('hi')])]));
    expect(detectContentFormat(json)).toBe('lexical-json');
    expect(detectContentFormat(`  ${json}\n`)).toBe('lexical-json');
    expect(detectContentFormat('{"a": 1}')).toBeNull();
    expect(detectContentFormat('{not json')).toBeNull();
  });

  it('recognises HTML source', () => {
    for (const html of [
      '<p>Hello <strong>there</strong></p>',
      '<!DOCTYPE html><html><body><h1>Title</h1></body></html>',
      '<div class="x">\n  <ul><li>one</li></ul>\n</div>',
      '<h2>Heading</h2>',
      '<img src="a.png" alt="">',
      '<!-- note --><p>x</p>',
    ]) {
      expect(detectContentFormat(html), html).toBe('html');
    }
    expect(detectContentFormat('<p>unclosed')).toBeNull();
    expect(detectContentFormat('<custom>thing</custom>')).toBeNull();
  });

  it('recognises Markdown block constructs', () => {
    for (const md of [
      '# Heading',
      'Intro\n\n## Second\n\ntext',
      '- one\n- two',
      '* star item',
      '1. first\n2. second',
      '> quoted',
      '```js\ncode\n```',
      'above\n\n---\n\nbelow',
      '| a | b |\n|---|---|\n| 1 | 2 |',
      '| a | b |\n| :--- | ---: |\n| 1 | 2 |',
      'Text[^1]\n\n[^1]: The note',
      ':::columns\nx\n:::',
      '::pagebreak',
    ]) {
      expect(detectContentFormat(md), md).toBe('markdown');
    }
  });

  it('recognises Markdown inline constructs', () => {
    for (const md of [
      'some **bold** text',
      'some *italic* text',
      'some ~~gone~~ text',
      'use `code` here',
      'a [link](https://example.com)',
      'a [page](/docs/page)',
      'a [section](#top)',
      'an ![image](img.png)',
      'under :u[lined] word',
      'اردو میں **موٹا** لفظ',
    ]) {
      expect(detectContentFormat(md), md).toBe('markdown');
    }
  });

  it('prefers the more specific format', () => {
    expect(detectContentFormat('<p># not a heading</p>')).toBe('html');
    const json = lexicalJsonConverter.serialize(makeState([paragraph([textNode('# x')])]));
    expect(detectContentFormat(json)).toBe('lexical-json');
  });
});

describe('hasSemanticHtml', () => {
  it('is false for the styled div/span wrapper code editors put on the clipboard', () => {
    expect(
      hasSemanticHtml(
        '<div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Consolas;"><div><span style="color: #569cd6;"># Title</span></div><br><div><span>- item</span></div></div>',
      ),
    ).toBe(false);
    expect(hasSemanticHtml('<pre><code>x</code></pre>')).toBe(false);
  });

  it('is true for a real rich-text fragment', () => {
    expect(hasSemanticHtml('<meta charset="utf-8"><p>Hello <b>you</b></p>')).toBe(true);
    expect(hasSemanticHtml('<span>a</span><a href="x">b</a>')).toBe(true);
  });
});
