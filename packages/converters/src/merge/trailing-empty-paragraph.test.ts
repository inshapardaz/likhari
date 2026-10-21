import { describe, expect, it } from 'vitest';
import { defaultFormatRegistry as registry } from '../registry';
import { makeState, paragraph, textNode, type SNode } from '../shared/serialized';

/**
 * mergePages(..., { joinParagraphs: 'blank-line' }) reads an empty paragraph at the end of a
 * page as "this paragraph ends here". That only works if saving a page keeps it, so these pin
 * down that every format does, Markdown included (as `::blank`, docs/markdown-dialect.md).
 */
const page = makeState([paragraph([textNode('text')]), paragraph()]);
const kinds = (state: unknown) => (state as { root: { children: SNode[] } }).root.children.map((b) => `${b.type}:${(b.children ?? []).length}`);

describe('a trailing empty paragraph survives saving and loading', () => {
  it.each(['lexical-json', 'html', 'plain-text', 'markdown'] as const)('in %s', (format) => {
    const saved = registry.serialize(format, page);
    expect(kinds(registry.parse(format, saved))).toEqual(['paragraph:1', 'paragraph:0']);
  });

  it('as several empty paragraphs too', () => {
    const many = makeState([paragraph([textNode('text')]), paragraph(), paragraph(), paragraph()]);
    for (const format of ['lexical-json', 'html', 'plain-text', 'markdown'] as const) {
      expect(kinds(registry.parse(format, registry.serialize(format, many))), format).toHaveLength(4);
    }
  });

  it('and Markdown writes it as ::blank, not as blank lines an editor could trim', () => {
    expect(registry.serialize('markdown', page)).toBe('text\n\n::blank\n');
  });
});
