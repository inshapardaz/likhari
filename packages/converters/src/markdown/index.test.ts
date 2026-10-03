import { describe, expect, it } from 'vitest';
import { markdownConverter } from './index';
import { elementBase, makeState, paragraph, textNode, type SNode } from '../shared/serialized';

const md = (blocks: SNode[]) => markdownConverter.serialize(makeState(blocks));
const parse = (src: string) => (markdownConverter.parse(src) as unknown as { root: { children: SNode[] } }).root.children;
const roundTrip = (blocks: SNode[]) => parse(md(blocks));

describe('markdownConverter', () => {
  it('writes standard Markdown for basic content', () => {
    expect(
      md([
        elementBase('heading', [textNode('Title')], { tag: 'h2' }),
        paragraph([textNode('a '), textNode('bold', 1), textNode(' and '), textNode('it', 2), textNode(' ~~')]),
      ]),
    ).toBe('## Title\n\na **bold** and *it* \\~\\~\n');
  });

  it('nests overlapping formats and keeps emphasis hugging its text', () => {
    expect(md([paragraph([textNode('x '), textNode('bold ', 1), textNode('both', 3), textNode(' y')])])).toBe('x **bold *both*** y\n');
  });

  it('uses directives for what Markdown lacks', () => {
    expect(md([paragraph([textNode('u', 8), textNode(' '), textNode('sup', 64), textNode(' '), textNode('red', 0, 'color: #f00; font-size: 20px')])])).toBe(
      ':u[u] :sup[sup] :span[red]{color="#f00" size="20px"}\n',
    );
  });

  it('round-trips inline formats, styles and links', () => {
    const [p] = roundTrip([
      paragraph([
        textNode('plain '), textNode('b', 1), textNode(' '), textNode('u', 8 | 2), textNode(' '), textNode('c', 16), textNode(' '),
        textNode('red', 0, 'font-family: Amiri; color: #f00'),
        elementBase('link', [textNode('site')], { url: 'https://x.test/', rel: null, target: null, title: null }),
      ]),
    ]);
    const kids = p.children as SNode[];
    expect(kids.map((k) => [k.text ?? k.type, Number(k.format ?? 0) || 0])).toEqual([
      ['plain ', 0], ['b', 1], [' ', 0], ['u', 10], [' ', 0], ['c', 16], [' ', 0], ['red', 0], ['link', 0],
    ]);
    expect(kids[7].style).toContain('font-family: Amiri');
    expect(kids[8]).toMatchObject({ url: 'https://x.test/' });
  });

  it('writes block attributes only when the reader could not infer them', () => {
    // Urdu paragraph that is rtl: inferable, no wrapper. Centered, indented, or forced direction: wrapper.
    const urdu = paragraph([textNode('سلام')], { direction: 'rtl' });
    expect(md([urdu])).toBe('سلام\n');
    expect(md([paragraph([textNode('سلام')], { direction: 'rtl', format: 'center', indent: 1 })])).toBe(
      ':::para{align="center" indent="1"}\nسلام\n:::\n',
    );
    expect(md([paragraph([textNode('Hello')], { direction: 'rtl' })])).toContain('dir="rtl"');
    const [p] = roundTrip([paragraph([textNode('سلام')], { direction: 'rtl', format: 'end', indent: 2 })]);
    // rtl is inferred from the Urdu text, so it isn't stored.
    expect(p).toMatchObject({ type: 'paragraph', format: 'end', indent: 2, direction: null });
    const [forced] = roundTrip([paragraph([textNode('Hello')], { direction: 'rtl' })]);
    expect(forced.direction).toBe('rtl');
  });

  it('round-trips lists, nested lists and tasks', () => {
    const li = (t: string, extra = {}) => elementBase('listitem', [textNode(t)], { value: 1, ...extra });
    const inner = elementBase('list', [li('inner')], { listType: 'bullet', start: 1, tag: 'ul' });
    const blocks = roundTrip([
      elementBase('list', [li('one'), elementBase('listitem', [inner], { value: 2 }), li('two')], { listType: 'number', start: 3, tag: 'ol' }),
      elementBase('list', [li('done', { checked: true }), li('todo', { checked: false })], { listType: 'check', start: 1, tag: 'ul' }),
    ]);
    expect(blocks[0]).toMatchObject({ listType: 'number', start: 3 });
    expect(blocks[0].children!.map((c) => c.children![0].type)).toEqual(['text', 'list', 'text']);
    expect(blocks[1].children!.map((c) => c.checked)).toEqual([true, false]);
  });

  it('round-trips tables (first row becomes the header)', () => {
    const cell = (t: string, h: number) => elementBase('tablecell', [paragraph([textNode(t)])], { headerState: h, colSpan: 1, rowSpan: 1 });
    const out = md([elementBase('table', [elementBase('tablerow', [cell('A', 1), cell('B', 1)]), elementBase('tablerow', [cell('1', 0), cell('2', 0)])])]);
    expect(out).toContain('| A | B |');
    const [table] = parse(out);
    expect(table.children).toHaveLength(2);
    expect(table.children![0].children![0].headerState).toBe(1);
    expect(table.children![1].children![1].children![0].children![0]).toMatchObject({ text: '2' });
  });

  it('round-trips images, captions, rules and page breaks', () => {
    const plain = { type: 'image', version: 1, src: 'https://x.test/a.png', altText: 'A', caption: null, linkType: 'linked', width: null, height: null };
    const figure = { ...plain, caption: 'Cap', width: 120 };
    expect(md([plain as SNode])).toBe('![A](https://x.test/a.png)\n');
    const blocks = roundTrip([plain as SNode, figure as SNode, { type: 'horizontalrule', version: 1 }, { type: 'page-break', version: 1 }]);
    expect(blocks[0]).toMatchObject({ type: 'image', altText: 'A', caption: null });
    expect(blocks[1]).toMatchObject({ type: 'image', caption: 'Cap', width: 120, height: null });
    expect(blocks.slice(2).map((b) => b.type)).toEqual(['horizontalrule', 'page-break']);
  });

  it('keeps quotes and line breaks', () => {
    const blocks = roundTrip([
      elementBase('quote', [textNode('q')]),
      paragraph([textNode('a'), { type: 'linebreak', version: 1 }, textNode('b')]),
    ]);
    expect(blocks.map((b) => b.type)).toEqual(['quote', 'paragraph']);
    expect((blocks[1].children as SNode[]).map((c) => c.type)).toEqual(['text', 'linebreak', 'text']);
  });

  it('round-trips a columns layout via the extended dialect', () => {
    const container = elementBase(
      'layout-container',
      [elementBase('layout-item', [paragraph([textNode('left')])]), elementBase('layout-item', [paragraph([textNode('right')])])],
      { templateColumns: 'repeat(2, 1fr)' },
    );
    const out = md([container]);
    expect(out).toContain(':::columns');
    expect(out).toContain(':::column');
    const [back] = parse(out);
    expect(back.type).toBe('layout-container');
    expect(back.children!.map((item) => item.type)).toEqual(['layout-item', 'layout-item']);
    expect((back.children![0].children![0] as SNode).children![0]).toMatchObject({ text: 'left' });
    expect((back.children![1].children![0] as SNode).children![0]).toMatchObject({ text: 'right' });
  });

  it('round-trips footnotes as [^1] + a reference block', () => {
    const footnoteList = elementBase('footnote-list', [
      elementBase('footnote-item', [paragraph([textNode('first note')])], { footnoteId: 'a' }),
      elementBase('footnote-item', [paragraph([textNode('second note')])], { footnoteId: 'b' }),
    ]);
    const body = paragraph([textNode('see'), { type: 'footnote-reference', version: 1, footnoteId: 'a' } as SNode, textNode('.')]);
    const out = md([body, footnoteList]);
    expect(out).toContain('[^a]');
    expect(out).toContain('[^a]: first note');

    const [backBody, backList] = parse(out);
    expect(backBody.children!.map((c) => c.type)).toEqual(['text', 'footnote-reference', 'text']);
    expect((backBody.children![1] as SNode).footnoteId).toBe('a');
    expect(backList.type).toBe('footnote-list');
    expect(backList.children!.map((item) => item.footnoteId)).toEqual(['a', 'b']);
    expect((backList.children![0].children![0] as SNode).children![0]).toMatchObject({ text: 'first note' });
  });

  it('round-trips a single-column poetry couplet via the extended dialect', () => {
    const couplet = elementBase('poetry-couplet', [paragraph([textNode('first misra')]), paragraph([textNode('second misra')])], {
      layout: 'single',
    });
    const out = md([couplet]);
    expect(out).toContain(':::poetry');
    const [back] = parse(out);
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'single' });
    expect(back.children!.map((c) => (c.children![0] as SNode).text)).toEqual(['first misra', 'second misra']);
  });

  it('round-trips a two-column poetry couplet (approximate, builds on the columns dialect)', () => {
    const container = elementBase(
      'layout-container',
      [elementBase('layout-item', [paragraph([textNode('left misra')])]), elementBase('layout-item', [paragraph([textNode('right misra')])])],
      { templateColumns: 'repeat(2, 1fr)' },
    );
    const couplet = elementBase('poetry-couplet', [container], { layout: 'two-column' });
    const out = md([couplet]);
    const [back] = parse(out);
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'two-column' });
    expect(back.children![0].type).toBe('layout-container');
    expect(back.children![0].children!.map((item) => (item.children![0].children![0] as SNode).text)).toEqual(['left misra', 'right misra']);
  });

  it('round-trips a poetry block with multiple couplets (single and two-column)', () => {
    const singleBlock = elementBase(
      'poetry-couplet',
      [paragraph([textNode('a1')]), paragraph([textNode('b1')]), paragraph([textNode('a2')]), paragraph([textNode('b2')])],
      { layout: 'single' },
    );
    const [backSingle] = parse(md([singleBlock]));
    expect(backSingle.children!.map((p) => (p.children![0] as SNode).text)).toEqual(['a1', 'b1', 'a2', 'b2']);

    const makeRow = (left: string, right: string) =>
      elementBase(
        'layout-container',
        [elementBase('layout-item', [paragraph([textNode(left)])]), elementBase('layout-item', [paragraph([textNode(right)])])],
        { templateColumns: 'repeat(2, 1fr)' },
      );
    const twoColumnBlock = elementBase('poetry-couplet', [makeRow('a1', 'b1'), makeRow('a2', 'b2')], { layout: 'two-column' });
    const [backTwoColumn] = parse(md([twoColumnBlock]));
    expect(backTwoColumn.children).toHaveLength(2);
    expect(backTwoColumn.children!.every((c) => c.type === 'layout-container')).toBe(true);
  });

  it('is safe on hostile input and tolerant of plain Markdown', () => {
    const blocks = parse('[x](javascript:alert(1)) ![i](javascript:alert(1))\n\n<script>alert(1)</script>\n\n10:30 and a:b');
    expect(JSON.stringify(blocks)).not.toMatch(/javascript|alert/);
    expect(JSON.stringify(blocks)).toContain('10:30');
  });

  it('parses empty input to one empty paragraph', () => {
    expect(parse('')).toHaveLength(1);
  });
});
