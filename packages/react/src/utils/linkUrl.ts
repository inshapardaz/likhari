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
