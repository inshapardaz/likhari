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

  it('round-trips a columns layout', () => {
    const container = elementBase(
      'layout-container',
      [elementBase('layout-item', [paragraph([textNode('left')])]), elementBase('layout-item', [paragraph([textNode('right')])])],
      { templateColumns: 'repeat(2, 1fr)' },
    );
    const [back] = blocksOf(roundTrip([container]));
    expect(back.type).toBe('layout-container');
    expect(back.templateColumns).toBe('repeat(2, 1fr)');
    expect(back.children!.map((item) => item.type)).toEqual(['layout-item', 'layout-item']);
    expect((back.children![0].children![0] as SNode).children![0]).toMatchObject({ text: 'left' });
    expect((back.children![1].children![0] as SNode).children![0]).toMatchObject({ text: 'right' });
  });

  it('round-trips footnotes: inline reference and list entry', () => {
    const footnoteList = elementBase('footnote-list', [
      elementBase('footnote-item', [paragraph([textNode('first note')])], { footnoteId: 'a' }),
      elementBase('footnote-item', [paragraph([textNode('second note')])], { footnoteId: 'b' }),
    ]);
    const body = paragraph([textNode('see'), { type: 'footnote-reference', version: 1, footnoteId: 'a' } as SNode, textNode('.')]);
    const [backBody, backList] = blocksOf(roundTrip([body, footnoteList]));

    expect(backBody.children!.map((c) => c.type)).toEqual(['text', 'footnote-reference', 'text']);
    expect((backBody.children![1] as SNode).footnoteId).toBe('a');

    expect(backList.type).toBe('footnote-list');
    expect(backList.children!.map((item) => item.footnoteId)).toEqual(['a', 'b']);
    expect((backList.children![0].children![0] as SNode).children![0]).toMatchObject({ text: 'first note' });
    expect((backList.children![1].children![0] as SNode).children![0]).toMatchObject({ text: 'second note' });
  });

  it('round-trips a single-column poetry couplet', () => {
    const couplet = elementBase('poetry-couplet', [paragraph([textNode('first misra')]), paragraph([textNode('second misra')])], {
      layout: 'single',
    });
    const [back] = blocksOf(roundTrip([couplet]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'single' });
    expect(back.children!.map((c) => (c.children![0] as SNode).text)).toEqual(['first misra', 'second misra']);
  });

  it('round-trips a two-column poetry couplet built on the layout primitive', () => {
    const container = elementBase(
      'layout-container',
      [elementBase('layout-item', [paragraph([textNode('left misra')])]), elementBase('layout-item', [paragraph([textNode('right misra')])])],
      { templateColumns: 'repeat(2, 1fr)' },
    );
    const couplet = elementBase('poetry-couplet', [container], { layout: 'two-column' });
    const [back] = blocksOf(roundTrip([couplet]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'two-column' });
    expect(back.children![0].type).toBe('layout-container');
    expect(back.children![0].children!.map((item) => (item.children![0].children![0] as SNode).text)).toEqual(['left misra', 'right misra']);
  });

  it('round-trips a poetry block with multiple couplets, single-column', () => {
    const block = elementBase(
      'poetry-couplet',
      [
        paragraph([textNode('a1')]),
        paragraph([textNode('b1')]),
        paragraph([textNode('a2')]),
        paragraph([textNode('b2')]),
      ],
      { layout: 'single' },
    );
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'single' });
    expect(back.children!.map((p) => (p.children![0] as SNode).text)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('round-trips a poetry block with multiple couplets, two-column (regression: only the first row survived)', () => {
    const makeRow = (left: string, right: string) =>
      elementBase(
        'layout-container',
        [elementBase('layout-item', [paragraph([textNode(left)])]), elementBase('layout-item', [paragraph([textNode(right)])])],
        { templateColumns: 'repeat(2, 1fr)' },
      );
    const block = elementBase('poetry-couplet', [makeRow('a1', 'b1'), makeRow('a2', 'b2')], { layout: 'two-column' });
    const [back] = blocksOf(roundTrip([block]));
    expect(back.children).toHaveLength(2);
    expect(back.children!.every((c) => c.type === 'layout-container')).toBe(true);
    const texts = back.children!.map((row) => row.children!.map((item) => (item.children![0].children![0] as SNode).text));
    expect(texts).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
    ]);
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

describe('poetry export', () => {
  it('writes the poetry styling inline and keeps its settings through a round trip', () => {
    const row = elementBase(
      'layout-container',
      [elementBase('layout-item', [paragraph([textNode('l')])]), elementBase('layout-item', [paragraph([textNode('r')])])],
      { templateColumns: 'repeat(2, 1fr)' },
    );
    const centered = elementBase('layout-container', [elementBase('layout-item', [paragraph([textNode('c1')]), paragraph([textNode('c2')])])], {
      templateColumns: '1fr',
    });
    const block = elementBase('poetry-couplet', [row, centered], { layout: 'two-column', spacing: 'relaxed', gutter: 'loose' });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('text-align: justify; text-align-last: justify');
    expect(html).toContain('border-inline-start: 1px dashed');
    expect(html).toContain('width: 60%'); // default centerWidth ('normal')
    expect(html).toContain('padding-inline-start: 48px');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'two-column', spacing: 'relaxed', gutter: 'loose', centerWidth: 'normal' });
    expect(back.children![1].children![0].children).toHaveLength(2);
  });

  it('keeps a non-default centered-couplet width through a round trip (issue #27)', () => {
    const centered = elementBase('layout-container', [elementBase('layout-item', [paragraph([textNode('c1')]), paragraph([textNode('c2')])])], {
      templateColumns: '1fr',
    });
    const block = elementBase('poetry-couplet', [centered], { layout: 'two-column', centerWidth: 'loose' });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('width: 85%');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'two-column', centerWidth: 'loose' });
  });

  it('keeps staggered placement and width through a round trip', () => {
    const lines = [paragraph([textNode('a')]), paragraph([textNode('b')]), paragraph([textNode('c')]), paragraph([textNode('d')])];
    const block = elementBase('poetry-couplet', lines, { layout: 'staggered', stagger: 'loose', width: 480 });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('width: 85%');
    expect(html).toContain('margin-inline-start: auto');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ layout: 'staggered', stagger: 'loose', width: 480 });
  });

  it('round-trips a musaddas (6-line) stanza, single-column shaped', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f'].map((t) => paragraph([textNode(t)]));
    const block = elementBase('poetry-couplet', lines, { layout: 'musaddas' });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('data-likhari-poetry-layout="musaddas"');
    expect(html).not.toContain('data-likhari-poetry-form');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'musaddas' });
    expect(back.children).toHaveLength(6);
  });

  it('round-trips a mukhammas (5-line) stanza', () => {
    const lines = ['a', 'b', 'c', 'd', 'e'].map((t) => paragraph([textNode(t)]));
    const block = elementBase('poetry-couplet', lines, { layout: 'mukhammas' });
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'mukhammas' });
    expect(back.children).toHaveLength(5);
  });

  it('round-trips a split stanzaVariant — same flat shape, just the extra attribute', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f'].map((t) => paragraph([textNode(t)]));
    const block = elementBase('poetry-couplet', lines, { layout: 'musaddas', stanzaVariant: 'split' });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('data-likhari-poetry-stanza-variant="split"');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'musaddas', stanzaVariant: 'split' });
    expect(back.children).toHaveLength(6);
  });

  it('defaults stanzaVariant to continuous for single/two-column/staggered', () => {
    const lines = ['a', 'b'].map((t) => paragraph([textNode(t)]));
    const block = elementBase('poetry-couplet', lines, { layout: 'single' });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('data-likhari-poetry-stanza-variant="continuous"');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'single', stanzaVariant: 'continuous' });
  });

  it('round-trips a mixed stanzaVariant — 2 two-column rows + trailing flat paragraphs — for musaddas and mukhammas', () => {
    const row = (a: string, b: string) =>
      elementBase(
        'layout-container',
        [elementBase('layout-item', [paragraph([textNode(a)])]), elementBase('layout-item', [paragraph([textNode(b)])])],
        { templateColumns: 'repeat(2, 1fr)' },
      );

    // musaddas: 2 rows (4 misras) + 2 trailing flat paragraphs.
    const musaddasBlock = elementBase(
      'poetry-couplet',
      [row('a', 'b'), row('c', 'd'), paragraph([textNode('e')]), paragraph([textNode('f')])],
      { layout: 'musaddas', stanzaVariant: 'mixed' },
    );
    const musaddasHtml = htmlConverter.serialize(makeState([musaddasBlock]));
    expect(musaddasHtml).toContain('data-likhari-poetry-stanza-variant="mixed"');
    const [musaddasBack] = blocksOf(roundTrip([musaddasBlock]));
    expect(musaddasBack).toMatchObject({ type: 'poetry-couplet', layout: 'musaddas', stanzaVariant: 'mixed' });
    expect(musaddasBack.children!.map((c) => c.type)).toEqual(['layout-container', 'layout-container', 'paragraph', 'paragraph']);
    expect((musaddasBack.children![2] as SNode).children![0]).toMatchObject({ text: 'e' });
    expect((musaddasBack.children![3] as SNode).children![0]).toMatchObject({ text: 'f' });

    // mukhammas: 2 rows (4 misras) + 1 trailing flat paragraph.
    const mukhammasBlock = elementBase(
      'poetry-couplet',
      [row('a', 'b'), row('c', 'd'), paragraph([textNode('e')])],
      { layout: 'mukhammas', stanzaVariant: 'mixed' },
    );
    const [mukhammasBack] = blocksOf(roundTrip([mukhammasBlock]));
    expect(mukhammasBack).toMatchObject({ type: 'poetry-couplet', layout: 'mukhammas', stanzaVariant: 'mixed' });
    expect(mukhammasBack.children!.map((c) => c.type)).toEqual(['layout-container', 'layout-container', 'paragraph']);
  });

  it('round-trips a centered trailing line in a mukhammas-mixed stanza, narrowed by centerWidth', () => {
    const row = (a: string, b: string) =>
      elementBase(
        'layout-container',
        [elementBase('layout-item', [paragraph([textNode(a)])]), elementBase('layout-item', [paragraph([textNode(b)])])],
        { templateColumns: 'repeat(2, 1fr)' },
      );
    // The trailing misra, centered: a LayoutContainerNode('1fr') holding one
    // LayoutItemNode holding the one paragraph — same encoding a centered
    // two-column row uses, reused for mukhammas's single trailing line.
    const centeredTrailing = elementBase('layout-container', [elementBase('layout-item', [paragraph([textNode('e')])])], {
      templateColumns: '1fr',
    });
    const block = elementBase('poetry-couplet', [row('a', 'b'), row('c', 'd'), centeredTrailing], {
      layout: 'mukhammas',
      stanzaVariant: 'mixed',
      centerWidth: 'loose',
    });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('width: 85%'); // loose centerWidth
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', layout: 'mukhammas', stanzaVariant: 'mixed', centerWidth: 'loose' });
    expect(back.children!.map((c) => c.type)).toEqual(['layout-container', 'layout-container', 'layout-container']);
    const trailing = back.children![2] as SNode;
    expect(trailing.children).toHaveLength(1);
    const trailingItem = trailing.children![0] as SNode;
    expect(trailingItem.children).toHaveLength(1);
    expect((trailingItem.children![0] as SNode).children![0]).toMatchObject({ text: 'e' });
  });

  it('round-trips autoWidth as fit-content, single-layout only', () => {
    const lines = [paragraph([textNode('a')]), paragraph([textNode('b')])];
    const block = elementBase('poetry-couplet', lines, { layout: 'single', autoWidth: true });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('width: fit-content');
    expect(html).toContain('data-likhari-poetry-auto-width="true"');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ type: 'poetry-couplet', autoWidth: true });
  });

  it('keeps a non-default stagger group through a round trip (request 3)', () => {
    const lines = [paragraph([textNode('a')]), paragraph([textNode('b')]), paragraph([textNode('c')]), paragraph([textNode('d')])];
    const block = elementBase('poetry-couplet', lines, { layout: 'staggered', staggerGroup: 2 });
    const html = htmlConverter.serialize(makeState([block]));
    expect(html).toContain('data-likhari-poetry-stagger-group="2"');
    const [back] = blocksOf(roundTrip([block]));
    expect(back).toMatchObject({ layout: 'staggered', staggerGroup: 2 });
  });
});

describe('html tables and footnotes export', () => {
  it('writes table and footnote styling inline', () => {
    const table = elementBase('table', [elementBase('tablerow', [elementBase('tablecell', [paragraph([textNode('x')])], { colSpan: 1, rowSpan: 1, headerState: 1 })])]);
    const html = htmlConverter.serialize(makeState([table]));
    expect(html).toContain('border-collapse: collapse');
    expect(html).toContain('border: 1px solid #cfcac0');
    expect(html).toContain('font-weight: 600');
  });

  it('numbers footnotes inline and drops the marker on import', () => {
    const blocks = [
      paragraph([textNode('see'), { type: 'footnote-reference', version: 1, footnoteId: 'n1' } as SNode]),
      elementBase('footnote-list', [elementBase('footnote-item', [paragraph([textNode('note text')])], { footnoteId: 'n1' })]),
    ];
    const html = htmlConverter.serialize(makeState(blocks));
    expect(html).toContain('[1] ');
    const [, list] = blocksOf(htmlConverter.parse(html));
    expect(list.type).toBe('footnote-list');
    expect((list.children![0].children![0] as SNode).children![0]).toMatchObject({ text: 'note text' });
  });
});
