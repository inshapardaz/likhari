import { ACCEPTED_IMAGE_TYPES } from './imageUrl';

/** A crop rectangle as fractions (0–1) of the image's width and height. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Converts a fractional crop rectangle to whole pixels inside a width x height
 * image, clamped so it never leaves the image and is at least 1px. */
export function toPixelRect(rect: CropRect, width: number, height: number) {
  const sx = Math.min(Math.max(Math.round(rect.x * width), 0), width - 1);
  const sy = Math.min(Math.max(Math.round(rect.y * height), 0), height - 1);
  const sw = Math.min(Math.max(Math.round(rect.w * width), 1), width - sx);
  const sh = Math.min(Math.max(Math.round(rect.h * height), 1), height - sy);
  return { sx, sy, sw, sh };
}

/** When one dimension changes with the aspect ratio locked, returns both. */
export function fitDimension(
  changed: 'width' | 'height',
  value: number,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const v = Math.max(1, Math.round(value));
  return changed === 'width'
    ? { width: v, height: Math.max(1, Math.round((v * naturalHeight) / naturalWidth)) }
    : { width: Math.max(1, Math.round((v * naturalWidth) / naturalHeight)), height: v };
}

/** MIME type to re-encode an edited image as: its own if it is a lossy/lossless
 * format canvas can write (JPEG, WebP, PNG), otherwise PNG (GIF, SVG, unknown). */
export function mimeFromSrc(src: string): string {
  const data = /^data:(image\/[a-z0-9.+-]+)[;,]/i.exec(src);
  const type = data ? data[1].toLowerCase() : extensionMime(src);
  return type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png';
}

function extensionMime(src: string): string {
  const match = /\.(jpe?g|webp|png|gif|svg)(?:[?#].*)?$/i.exec(src);
  if (!match) return 'image/png';
  const ext = match[1].toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
}

/** Approximate decoded size, in bytes, of a base64 data URI. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const base64 = comma === -1 ? '' : dataUrl.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(',');
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'image/png';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export const CANNOT_DOWNLOAD =
  "Couldn't download this image (its server doesn't allow it). Download the file and upload it instead.";

/** Downloads an image and returns it as a base64 data URI, to embed it in the
 * document. Needs the image's server to allow cross-origin reads (CORS). */
export async function fetchImageAsDataUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (/^data:image\//i.test(url)) return url;
  let blob: Blob;
  try {
    const response = await fetchImpl(url, { mode: 'cors' });
    if (!response.ok) throw new Error('bad status');
    blob = await response.blob();
  } catch {
    throw new Error(CANNOT_DOWNLOAD);
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(blob.type)) throw new Error("That URL doesn't point to a PNG, JPEG, GIF, WebP or SVG image");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(CANNOT_DOWNLOAD));
    reader.readAsDataURL(blob);
  });
}

export type PixelOp =
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'flip'; axis: 'horizontal' | 'vertical' }
  | { type: 'crop'; rect: CropRect };

/** Loads an image for canvas use. External URLs are requested with CORS so the
 * canvas isn't tainted; a server that doesn't allow that makes this reject. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    img.src = src;
  });
}

export const CANNOT_EDIT_PIXELS =
  "This image can't be edited here (its server doesn't allow it). Upload the file instead to crop or rotate it.";

/** Applies a rotate / flip / crop to an image and returns the result as a data URI. */
export async function applyPixelOp(src: string, op: PixelOp): Promise<string> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    throw new Error(CANNOT_EDIT_PIXELS);
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new Error('This image has no pixel size to edit (some SVGs). Upload a PNG or JPEG instead.');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image editing is not available in this browser');

  if (op.type === 'rotate') {
    canvas.width = height;
    canvas.height = width;
    ctx.translate(height / 2, width / 2);
    ctx.rotate(op.direction === 'cw' ? Math.PI / 2 : -Math.PI / 2);
    ctx.drawImage(img, -width / 2, -height / 2);
  } else if (op.type === 'flip') {
    canvas.width = width;
    canvas.height = height;
    ctx.translate(op.axis === 'horizontal' ? width : 0, op.axis === 'vertical' ? height : 0);
    ctx.scale(op.axis === 'horizontal' ? -1 : 1, op.axis === 'vertical' ? -1 : 1);
    ctx.drawImage(img, 0, 0);
  } else {
    const { sx, sy, sw, sh } = toPixelRect(op.rect, width, height);
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  }

  try {
    return canvas.toDataURL(mimeFromSrc(src), 0.92);
  } catch {
    throw new Error(CANNOT_EDIT_PIXELS);
  }
}
