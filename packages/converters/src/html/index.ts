import type { FormatConverter } from '../types';
import { serializeHtml } from './serialize';
import { parseHtml } from './parse';

/**
 * HTML export/import (lexical-editor-spec.md §2.2). Export is pure string
 * generation over the serialized tree; import needs a DOM parser, which the
 * browser (and jsdom in tests) provides.
 */
export const htmlConverter: FormatConverter = {
  id: 'html',
  serialize: (state, ctx) => serializeHtml(state, ctx),
  parse: (input, ctx) => parseHtml(input, ctx),
};
