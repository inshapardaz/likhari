import { describe, expect, it } from 'vitest';
import { normalizeImageUrl, validateImageFile } from './imageUrl';

describe('normalizeImageUrl', () => {
  it('accepts http(s), relative and image data URIs', () => {
    for (const url of ['https://a.com/x.png', 'http://a.com/x.jpg', '/img/a.png', './a.png', '../a.png', 'data:image/png;base64,iVBORw0KGgo=']) {
      expect(normalizeImageUrl(url)).toBe(url);
    }
  });

  it('trims whitespace', () => {
    expect(normalizeImageUrl('  https://a.com/x.png ')).toBe('https://a.com/x.png');
  });

  it('rejects script, non-image data and other schemes', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd', 'ftp://a.com/x.png', 'x.png', '']) {
      expect(normalizeImageUrl(url)).toBeNull();
    }
  });
});

describe('validateImageFile', () => {
  it('accepts supported types under the size limit', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 }, 5)).toBeNull();
  });

  it('rejects unsupported types', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 10 }, 5)).toMatch(/PNG/);
  });

  it('rejects files over the limit', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }, 5)).toMatch(/5 MB/);
  });
});
