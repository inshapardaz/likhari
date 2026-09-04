import type { FormatConverter } from '../types';

/**
 * Placeholder — the extended Markdown dialect (lexical-editor-spec.md §2.1)
 * is Phase 2 work (§13) and needs its own spec doc + sign-off before the
 * converter is built against it. Registered now so FormatRegistry's shape
 * is stable and callers get a clear error instead of a missing format.
 */
export const markdownConverter: FormatConverter = {
  id: 'markdown',
  serialize() {
    throw new Error(
      '@likhari/converters: the extended Markdown dialect is not implemented yet (Phase 2, see docs/lexical-editor-spec.md §2.1 and §13).',
    );
  },
  parse() {
    throw new Error(
      '@likhari/converters: the extended Markdown dialect is not implemented yet (Phase 2, see docs/lexical-editor-spec.md §2.1 and §13).',
    );
  },
};
