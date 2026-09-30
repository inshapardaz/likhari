/**
 * Validates the source of a linked image. Accepts http(s) URLs, relative
 * paths, and base64 raster/SVG data URIs (what an embedded image stores);
 * anything else (javascript:, other data: types, file:, ...) is rejected.
 * Returns the trimmed URL, or null when it should be refused.
 */
export function normalizeImageUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  if (/^https?:\/\/\S+$/i.test(url)) return url;
  if (/^(\/|\.\.?\/)\S*$/.test(url)) return url;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  return null;
}

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

/** Returns an error message if the file can't be inserted, otherwise null. */
export function validateImageFile(file: { type: string; size: number }, maxSizeMB: number): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, GIF, WebP or SVG image';
  if (file.size > maxSizeMB * 1024 * 1024) return `Image is larger than ${maxSizeMB} MB`;
  return null;
}
