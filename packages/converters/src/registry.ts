import type { FormatConverter, FormatId, ConverterContext } from './types';
import { plainTextConverter } from './plain-text';
import { lexicalJsonConverter } from './lexical-json';
import { markdownConverter } from './markdown';
import { htmlConverter } from './html';

/**
 * Maps every FormatId to its converter pair (architecture doc §8). The
 * public API's getContent(format)/setContent(str, format) is a thin dispatch
 * over this — adding a future format doesn't touch the editor component.
 */
export class FormatRegistry {
  private readonly converters = new Map<FormatId, FormatConverter>();

  constructor(converters: FormatConverter[]) {
    for (const converter of converters) {
      this.converters.set(converter.id, converter);
    }
  }

  get(format: FormatId): FormatConverter {
    const converter = this.converters.get(format);
    if (!converter) {
      throw new Error(`@likhari/converters: no converter registered for format "${format}".`);
    }
    return converter;
  }

  serialize(format: FormatId, editorState: Parameters<FormatConverter['serialize']>[0], ctx?: ConverterContext): string {
    return this.get(format).serialize(editorState, ctx);
  }

  parse(format: FormatId, input: string, ctx?: ConverterContext) {
    return this.get(format).parse(input, ctx);
  }
}

export const defaultFormatRegistry = new FormatRegistry([
  plainTextConverter,
  lexicalJsonConverter,
  markdownConverter,
  htmlConverter,
]);
