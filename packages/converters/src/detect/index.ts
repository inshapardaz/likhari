import type { FormatId } from '../types';

/**
 * Formats `detectContentFormat` can tell apart from plain text. Plain text is
 * `null`: the caller's default handling (line-by-line insertion, link
 * detection, ...) is the right thing for it.
 */
export type DetectedFormat = Exclude<FormatId, 'plain-text'>;

/** Block constructs that only make sense as Markdown. Anchored to a line start. */
const MARKDOWN_BLOCK_PATTERNS: RegExp[] = [
  /^ {0,3}#{1,6}[ \t]+\S/m, // heading
  /^ {0,3}[-*+][ \t]+\S/m, // bullet item
  /^ {0,3}\d{1,3}[.)][ \t]+\S/m, // numbered item (years are left alone)
  /^ {0,3}>[ \t]?\S/m, // block quote
  /^ {0,3}(?:```|~~~)/m, // fenced code
  /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/m, // thematic break
  /^ {0,3}\|.*\|[ \t]*\r?\n {0,3}\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/m, // table header + separator
  /^ {0,3}\[\^[^\]\s]+\]:[ \t]/m, // footnote definition
  /^ {0,3}:::?[a-z]/im, // directive (container or leaf) from the extended dialect
];

/** Inline constructs: a run of prose with any of these is Markdown too. */
const MARKDOWN_INLINE_PATTERNS: RegExp[] = [
  /!\[[^\]\n]*\]\([^)\n]+\)/, // image
  /\[[^\]\n]+\]\((?:https?:\/\/|mailto:|tel:|\/|\.{1,2}\/|#)[^)\n]*\)/, // link
  /\*\*(?=\S)[^*\n]+?(?<=\S)\*\*/, // bold (`**x**` only: `__x__` is too often an identifier such as `__init__`)
  /(?<![\w*])\*(?=[^\s*])[^*\n]+?(?<=[^\s*])\*(?![\w*])/, // italic (`*x*` only: `_x_` is too often an identifier)
  /~~(?=\S)[^~\n]+?(?<=\S)~~/, // strikethrough
  /(?<!`)`[^`\n]+`(?!`)/, // inline code
  /\[\^[^\]\s]+\]/, // footnote reference
  /:(?:u|sup|sub|mark|color|bg|style)\[[^\]\n]+\]/, // text directive from the extended dialect
];

/** Tags that only appear in HTML source, with their attributes, at the start of the text. */
const HTML_START =
  /^\s*(?:<!doctype\s+html|<!--|<(?:html|head|body|p|div|span|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|pre|code|hr|br|img|a|strong|em|b|i|u|s|del|ins|sup|sub|mark|section|article|main|header|footer|nav|aside|figure|figcaption|dl|dt|dd)(?:\s[^<>]*)?\/?>)/i;

const HTML_CLOSING_OR_VOID = /<\/[a-z][a-z0-9-]*\s*>|<(?:br|hr|img)\b[^<>]*>/i;

/** Elements whose presence means the HTML carries structure or formatting of its own. */
const SEMANTIC_HTML = /<(?:p|h[1-6]|ul|ol|li|table|tr|td|th|blockquote|a|b|strong|em|i|u|s|del|ins|sup|sub|mark|img|hr|figure)\b/i;

export function isLexicalJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(trimmed) as { root?: { type?: unknown; children?: unknown } } | null;
    return parsed?.root?.type === 'root' && Array.isArray(parsed.root.children);
  } catch {
    return false;
  }
}

export function isHtmlSource(text: string): boolean {
  return HTML_START.test(text) && HTML_CLOSING_OR_VOID.test(text);
}

export function isMarkdown(text: string): boolean {
  return MARKDOWN_BLOCK_PATTERNS.some((p) => p.test(text)) || MARKDOWN_INLINE_PATTERNS.some((p) => p.test(text));
}

/**
 * True when an HTML fragment has formatting or structure worth keeping:
 * paragraphs, headings, lists, links, emphasis, ... A fragment of only
 * `div`/`span`/`br`/`pre`/`code` with inline styles is how code editors and
 * terminals copy text; its text content is the content.
 */
export function hasSemanticHtml(html: string): boolean {
  return SEMANTIC_HTML.test(html);
}

/**
 * Guesses which interchange format a piece of text is written in, so content
 * copied as text (Markdown from another editor, HTML source, a Lexical JSON
 * export) can be imported through the matching parser instead of landing as
 * literal syntax.
 *
 * Checks are ordered from most to least specific: Lexical JSON (must parse,
 * with a `root` node), HTML source (opens with a known tag and closes one),
 * then Markdown (any block construct, or inline link/image/emphasis/code).
 * Prose with none of these is `null`.
 */
export function detectContentFormat(text: string): DetectedFormat | null {
  if (!text || !text.trim()) return null;
  if (isLexicalJson(text)) return 'lexical-json';
  if (isHtmlSource(text)) return 'html';
  if (isMarkdown(text)) return 'markdown';
  return null;
}
