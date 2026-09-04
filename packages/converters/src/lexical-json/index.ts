import type { SerializedEditorState } from 'lexical';
import type { FormatConverter } from '../types';

/**
 * The native/lossless format — the only one that round-trips 100% of state
 * (custom nodes, exact attributes). Used for autosave and internal storage
 * (lexical-editor-spec.md §2).
 */
export const lexicalJsonConverter: FormatConverter = {
  id: 'lexical-json',

  serialize(editorState) {
    return JSON.stringify(editorState);
  },

  parse(input) {
    return JSON.parse(input) as SerializedEditorState;
  },
};
