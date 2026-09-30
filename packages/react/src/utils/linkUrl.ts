/**
 * Normalizes a URL typed into the link dialog, or returns null if it should
 * be rejected. Only http(s), mailto, tel, in-page (#), and relative URLs are
 * accepted — any other scheme (javascript:, data:, vbscript:, ...) is
 * refused so a pasted link can't carry script into exported HTML. A bare
 * domain like "example.com/page" gets https:// prefixed.
 */
export function normalizeLinkUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;

  if (/^(https?:\/\/|mailto:|tel:)\S+$/i.test(url)) return url;
  if (/^(#|\/|\.\.?\/)\S*$/.test(url)) return url;

  // Any other explicit scheme is rejected.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;

  // Looks like a bare domain (no spaces, has a dot in its host part).
  if (/^[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/.test(url)) return `https://${url}`;

  return null;
}

export type PastedSegment = { type: 'text'; text: string } | { type: 'link'; text: string; url: string };

const PASTED_URL_PATTERN = /(?:https?:\/\/|mailto:|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

/**
 * Splits pasted plain text into text and link segments. Only explicit URLs
 * count (http(s)://, mailto:, or a www. prefix) — a bare "file.txt" or
 * "example.com" is left as text, since pasted prose is full of those. Trailing
 * sentence punctuation stays outside the link, and anything normalizeLinkUrl
 * rejects stays text.
 */
export function splitPastedText(text: string): PastedSegment[] {
  const segments: PastedSegment[] = [];
  let last = 0;
  const pushText = (value: string) => {
    if (!value) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === 'text') previous.text += value;
    else segments.push({ type: 'text', text: value });
  };

  for (const match of text.matchAll(PASTED_URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(TRAILING_PUNCTUATION, '');
    const url = normalizeLinkUrl(/^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed);
    pushText(text.slice(last, start));
    if (url && trimmed.length > 'www.'.length) {
      segments.push({ type: 'link', text: trimmed, url });
      pushText(raw.slice(trimmed.length));
    } else {
      pushText(raw);
    }
    last = start + raw.length;
  }
  pushText(text.slice(last));
  return segments;
}
