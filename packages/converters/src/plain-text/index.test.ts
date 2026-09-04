import { describe, expect, it } from 'vitest';
import { plainTextConverter } from './index';
import { lexicalJsonConverter } from '../lexical-json';

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
});
