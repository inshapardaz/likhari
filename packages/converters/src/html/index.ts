import type { FormatConverter } from '../types';

/**
 * Placeholder — HTML import/export is Phase 2 work (lexical-editor-spec.md
 * §13). Registered now so FormatRegistry's shape is stable and callers get a
 * clear error instead of a missing format.
 */
export const htmlConverter: FormatConverter = {
  id: 'html',
  serialize() {
    throw new Error('@likhari/converters: HTML export is not implemented yet (Phase 2, see docs/lexical-editor-spec.md §13).');
  },
  parse() {
    throw new Error('@likhari/converters: HTML import is not implemented yet (Phase 2, see docs/lexical-editor-spec.md §13).');
  },
};
