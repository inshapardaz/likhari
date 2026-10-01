import { describe, expect, it } from 'vitest';
import { htmlConverter } from './index';
import { makeState, paragraph, textNode, elementBase, type SNode } from '../shared/serialized';

const roundTrip = (blocks: SNode[]) => htmlConverter.parse(htmlConverter.serialize(makeState(blocks)));
const blocksOf = (state: unknown) => (state as { root: { children: SNode[] } }).root.children;

describe('htmlConverter', () => {
  it('exports paragraphs, inline formats and escapes text', () => {
    const html = htmlConverter.serialize(
      makeState([paragraph([textNode('a < b & ', 0), textNode('bold', 1), textNode(' it', 2 | 8)])]),
    );
    expect(html).toBe('<p>a &lt; b &amp; <strong>bold</strong><u><em> it</em></u></p>');
  });

  it('round-trips direction, alignment and indent', () => {
    const [p] = blocksOf(roundTrip([paragraph([textNode('سلام')], { direction: 'rtl', format: 'start', indent: 2 })]));
    expect(p).toMatchObject({ type: 'paragraph', direction: 'rtl', format: 'start', indent: 2 });
    expect((p.children![0] as SNode).text).toBe('سلام');
  });

  it('round-trips headings, quotes, links and formats', () => {
    const blocks = blocksOf(
      roundTrip([
        elementBase('heading', [textNode('Title')], { tag: 'h2' }),
        elementBase('quote', [textNode('quoted', 2)]),
        paragraph([elementBase('link', [textNode('site', 1)], { url: 'https://x.test/', rel: null, target: null, title: null })]),
      ]),
    );
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'quote', 'paragraph']);
    expect(blocks[0].tag).toBe('h2');
    expect(blocks[1].children![0]).toMatchObject({ text: 'quoted', format: 2 });
    expect(blocks[2].children![0]).toMatchObject({ type: 'link', url: 'https://x.test/' });
    expect((blocks[2].children![0] as SNode).children![0]).toMatchObject({ text: 'site', format: 1 });
  });

  it('round-trips lists including nested and checked items', () => {
    const li = (text: string, extra = {}) => elementBase('listitem', [textNode(text)], { value: 1, ...extra });
    const nested = elementBase('list', [li('inner')], { listType: 'bullet', start: 1, tag: 'ul' });
    const blocks = blocksOf(
      roundTrip([
        elementBase('list', [li('one'), elementBase('listitem', [nested], { value: 2 })], { listType: 'number', start: 3, tag: 'ol' }),
        elementBase('list', [li('done', { checked: true }), li('todo', { checked: false })], { listType: 'check', start: 1, tag: 'ul' }),
      ]),
    );
    expect(blocks[0]).toMatchObject({ listType: 'number', start: 3 });
    expect(blocks[0].children).toHaveLength(2);
    expect((blocks[0].children![1].children![0] as SNode).type).toBe('list');
    expect(blocks[1].children!.map((c) => c.checked)).toEqual([true, false]);
  });

  it('round-trips tables with header row', () => {
    const cell = (text: string, headerState: number) =>
      elementBase('tablecell', [paragraph([textNode(text)])], { headerState, colSpan: 1, rowSpan: 1 });
    const [table] = blocksOf(
      roundTrip([elementBase('table', [elementBase('tablerow', [cell('H', 1)]), elementBase('tablerow', [cell('D', 0)])])]),
    );
    expect(table.children!.map((r) => r.children![0].headerState)).toEqual([1, 0]);
  });

  it('round-trips images, captions, hr and page breaks', () => {
    const image = { type: 'image', version: 1, src: 'https://x.test/a.png', altText: 'A', caption: 'Cap', linkType: 'linked', width: 100, height: null };
    const blocks = blocksOf(
      roundTrip([image as SNode, { type: 'horizontalrule', version: 1 }, { type: 'page-break', version: 1 }]),
    );
    expect(blocks[0]).toMatchObject({ type: 'image', altText: 'A', caption: 'Cap', width: 100, height: null, linkType: 'linked' });
    expect(blocks.slice(1).map((b) => b.type)).toEqual(['horizontalrule', 'page-break']);
  });

  it('imports arbitrary web HTML: bare text, spans, inline styles', () => {
    const blocks = blocksOf(
      htmlConverter.parse('<div>Hello <b>big</b> <span style="font-style: italic">world</span></div><p>Two</p>'),
    );
    expect(blocks).toHaveLength(2);
    const texts = blocks[0].children as SNode[];
    expect(texts.map((t) => [t.text, t.format])).toEqual([['Hello ', 0], ['big', 1], [' ', 0], ['world', 2]]);
  });

  it('strips scripts and unsafe URLs', () => {
    const blocks = blocksOf(
      htmlConverter.parse('<script>alert(1)</script><p><a href="javascript:alert(1)">x</a><img src="javascript:alert(1)"></p>'),
    );
    expect(JSON.stringify(blocks)).not.toMatch(/javascript|alert/);
  });

  it('parses empty input to a single empty paragraph', () => {
    expect(blocksOf(htmlConverter.parse(''))).toHaveLength(1);
  });
});
