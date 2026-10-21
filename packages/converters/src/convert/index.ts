import type { SerializedEditorState } from 'lexical';
import { defaultFormatRegistry, type FormatRegistry } from '../registry';
import type { ConverterContext, FormatId } from '../types';
import { cleanState } from './clean';

export { cleanState };

export interface ConvertContentOptions {
  /** The format `content` is in. */
  inputFormat: FormatId;
  /** The format to write. */
  outputFormat: FormatId;
  /**
   * Tidy the text on the way (see `cleanState`): Unicode NFC, repeated spaces collapsed, stray
   * spaces at the edges of blocks trimmed, look-alike runs merged. On by default; pass `false`
   * to convert exactly what is there.
   */
  clean?: boolean;
  /** Passed to the parse and the serialize (image URL resolver and the like). */
  context?: ConverterContext;
  /** Defaults to the registry with all four built-in formats. */
  registry?: FormatRegistry;
}

/** Reads `content` and returns it as Lexical state, cleaned unless `clean` is false. */
export function convertContentToState(content: string, options: Omit<ConvertContentOptions, 'outputFormat'>): SerializedEditorState {
  const { inputFormat, clean = true, context, registry = defaultFormatRegistry } = options;
  let state: SerializedEditorState;
  try {
    state = registry.parse(inputFormat, content, context);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`convertContent: the input is not valid ${inputFormat}: ${reason}`);
  }
  return clean ? cleanState(state) : state;
}

/**
 * Converts a document from one format to another through the editor's own parsers and
 * serializers, so the result is exactly what the editor would save in that format. Needs no
 * editor or DOM for Markdown, Lexical JSON and plain text (HTML input uses `DOMParser`).
 *
 * Going to a format that holds less than the input (rich text to plain text, a table to
 * Markdown, ...) degrades the way the format's fidelity matrix says; see
 * `docs/lexical-editor-spec.md` and `docs/markdown-dialect.md`.
 */
export function convertContent(content: string, options: ConvertContentOptions): string {
  const registry = options.registry ?? defaultFormatRegistry;
  return registry.serialize(options.outputFormat, convertContentToState(content, options), options.context);
}
