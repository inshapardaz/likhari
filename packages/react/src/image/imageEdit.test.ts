import { describe, expect, it } from 'vitest';
import { CANNOT_DOWNLOAD, dataUrlBytes, dataUrlToFile, fetchImageAsDataUrl, fitDimension, mimeFromSrc, toPixelRect } from './imageEdit';

describe('toPixelRect', () => {
  it('converts fractions to whole pixels', () => {
    expect(toPixelRect({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 200, 100)).toEqual({ sx: 50, sy: 50, sw: 100, sh: 25 });
  });

  it('clamps a rectangle that runs past the image', () => {
    expect(toPixelRect({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 100, 100)).toEqual({ sx: 90, sy: 90, sw: 10, sh: 10 });
  });

  it('never returns an empty rectangle', () => {
    const r = toPixelRect({ x: 0.5, y: 0.5, w: 0, h: 0 }, 100, 100);
    expect(r.sw).toBeGreaterThanOrEqual(1);
    expect(r.sh).toBeGreaterThanOrEqual(1);
  });
});

describe('fitDimension', () => {
  it('derives height from width', () => {
    expect(fitDimension('width', 100, 400, 200)).toEqual({ width: 100, height: 50 });
  });

  it('derives width from height', () => {
    expect(fitDimension('height', 100, 400, 200)).toEqual({ width: 200, height: 100 });
  });

  it('never returns zero', () => {
    expect(fitDimension('width', 0, 1000, 10)).toEqual({ width: 1, height: 1 });
  });
});

describe('mimeFromSrc', () => {
  it('keeps JPEG and WebP, and falls back to PNG for everything else', () => {
    expect(mimeFromSrc('data:image/jpeg;base64,AAAA')).toBe('image/jpeg');
    expect(mimeFromSrc('data:image/webp;base64,AAAA')).toBe('image/webp');
    expect(mimeFromSrc('data:image/gif;base64,AAAA')).toBe('image/png');
    expect(mimeFromSrc('https://a.com/x.JPG?v=2')).toBe('image/jpeg');
    expect(mimeFromSrc('https://a.com/x')).toBe('image/png');
  });
});

describe('data URL helpers', () => {
  it('measures decoded size', () => {
    expect(dataUrlBytes('data:image/png;base64,QUJD')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,QUI=')).toBe(2);
  });

  it('round-trips into a File with its MIME type', () => {
    const file = dataUrlToFile('data:image/png;base64,QUJD', 'a.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(3);
    expect(file.name).toBe('a.png');
  });
});

describe('fetchImageAsDataUrl', () => {
  const respond = (type: string) => async () => new Blob(['abc'], { type });
  const failWith = (err: unknown) => async () => {
    throw err;
  };

  it('downloads an image as a data URI', async () => {
    const dataUrl = await fetchImageAsDataUrl('https://a.com/x.png', respond('image/png'));
    expect(dataUrl).toBe('data:image/png;base64,YWJj');
  });

  it('passes an existing data URI straight through', async () => {
    expect(await fetchImageAsDataUrl('data:image/png;base64,QUJD', failWith(new Error('should not fetch')))).toBe(
      'data:image/png;base64,QUJD',
    );
  });

  it('explains a blocked or failed download', async () => {
    await expect(fetchImageAsDataUrl('https://a.com/x.png', failWith(new TypeError('Failed to fetch')))).rejects.toThrow(
      CANNOT_DOWNLOAD,
    );
    await expect(fetchImageAsDataUrl('https://a.com/x.png', failWith(new Error('bad status')))).rejects.toThrow(CANNOT_DOWNLOAD);
  });

  it('refuses a URL that is not an image', async () => {
    await expect(fetchImageAsDataUrl('https://a.com/page', respond('text/html'))).rejects.toThrow(/doesn't point to/);
  });

  it('uses a host-provided fetcher to work around CORS, instead of the browser fetch', async () => {
    let requestedUrl: string | undefined;
    const proxied = async (url: string) => {
      requestedUrl = url;
      return new Blob(['abc'], { type: 'image/png' });
    };
    await fetchImageAsDataUrl('https://a.com/x.png', proxied);
    expect(requestedUrl).toBe('https://a.com/x.png');
  });
});
