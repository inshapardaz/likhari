import type { FormatConverter } from '../types';
import { serializeMarkdown } from './serialize';
import { parseMarkdown } from './parse';

/**
 * Extended Markdown (docs/markdown-dialect.md, ADR-0001): GFM plus a small
 * set of directives, built on unified/remark so the same mdast tree can be
 * rendered elsewhere.
 */
export const markdownConverter: FormatConverter = {
  id: 'markdown',
  serialize: (state, ctx) => serializeMarkdown(state, ctx),
  parse: (input, ctx) => parseMarkdown(input, ctx),
};
