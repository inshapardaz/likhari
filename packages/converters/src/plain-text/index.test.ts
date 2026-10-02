import type { SerializedEditorState } from 'lexical';
import { describe, expect, it } from 'vitest';
import { plainTextConverter } from './index';
import { lexicalJsonConverter } from '../lexical-json';
import { elementBase, makeState, paragraph, textNode, type SNode } from '../shared/serialized';

describe('plainTextConverter', () => {
  it('joins paragraph blocks with a blank line', () => {
    const state = plainTextConverter.parse('Hello world\n\nSecond paragraph');
    const text = plainTextConverter.serialize(state);
    expect(text).toBe('Hello world\n\nSecond paragraph');
  });

  it('round-trips through lexical-json unchanged', () => {
    const state = plainTextConverter.parse('One\n\nTwo\n\nThree');
    const json = lexicalJsonConverter.serialize(state);
    const restored = lexicalJsonConverter.parse(json);
    expect(plainTextConverter.serialize(restored)).toBe('One\n\nTwo\n\nThree');
  });

  it('produces a single empty paragraph for empty input', () => {
    const state = plainTextConverter.parse('');
    expect((state.root as { children: unknown[] }).children).toHaveLength(1);
    expect(plainTextConverter.serialize(state)).toBe('');
  });

  it('keeps an image\'s alt text (or caption) and drops its data', () => {
    const state = plainTextConverter.parse('Before');
    const root = state.root as unknown as { children: unknown[] };
    const image = (altText: string, caption: string | null) => ({
      type: 'image',
      version: 1,
      src: 'data:image/png;base64,AAAA',
      altText,
      caption,
      linkType: 'embedded',
      width: null,
      height: null,
    });
    root.children.push(image('A cat', 'ignored'), image('', 'Only a caption'), image('', null));
    expect(plainTextConverter.serialize(state)).toBe('Before\n\nA cat\n\nOnly a caption\n\n');
  });

  it('renders footnotes as an inline bracketed number plus a trailing list', () => {
    const body = paragraph([
      textNode('see'),
      { type: 'footnote-reference', version: 1, footnoteId: 'a' } as SNode,
      textNode(' and '),
      { type: 'footnote-reference', version: 1, footnoteId: 'b' } as SNode,
      textNode('.'),
    ]);
    const footnoteList = elementBase('footnote-list', [
      elementBase('footnote-item', [paragraph([textNode('first note')])], { footnoteId: 'a' }),
      elementBase('footnote-item', [paragraph([textNode('second note')])], { footnoteId: 'b' }),
    ]);
    const state = makeState([body, footnoteList]) as unknown as SerializedEditorState;
    expect(plainTextConverter.serialize(state)).toBe('see[1] and [2].\n\n[1] first note\n[2] second note');
  });
});
