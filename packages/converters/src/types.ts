import type { SerializedEditorState } from 'lexical';

/** editor-architecture-design.md §8 / §9 — the four interchange formats. */
export type FormatId = 'markdown' | 'html' | 'plain-text' | 'lexical-json';

/**
 * Carries cross-cutting data a converter may need beyond the EditorState tree
 * itself — the out-of-band footnote registry (architecture doc §3.3) and a
 * host-supplied image URL resolver — without coupling converters to the
 * editor or React.
 */
export interface ConverterContext {
  footnoteRegistry?: Record<string, string>;
  resolveImageUrl?: (src: string) => string;
}

export interface FormatConverter {
  readonly id: FormatId;
  serialize(editorState: SerializedEditorState, ctx?: ConverterContext): string;
  parse(input: string, ctx?: ConverterContext): SerializedEditorState;
}
