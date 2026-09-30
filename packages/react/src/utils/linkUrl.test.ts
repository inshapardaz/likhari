import { describe, expect, it } from 'vitest';
import { normalizeLinkUrl } from './linkUrl';

describe('normalizeLinkUrl', () => {
  it('keeps http(s), mailto, tel, hash and relative URLs', () => {
    for (const url of ['https://a.com/x?y=1#z', 'http://a.com', 'mailto:a@b.com', 'tel:+123', '#top', '/docs', './a', '../a']) {
      expect(normalizeLinkUrl(url)).toBe(url);
    }
  });

  it('trims whitespace', () => {
    expect(normalizeLinkUrl('  https://a.com  ')).toBe('https://a.com');
  });

  it('prefixes bare domains with https://', () => {
    expect(normalizeLinkUrl('example.com')).toBe('https://example.com');
    expect(normalizeLinkUrl('example.com/a?b=1')).toBe('https://example.com/a?b=1');
  });

  it('rejects dangerous or unknown schemes', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', 'ftp://a.com']) {
      expect(normalizeLinkUrl(url)).toBeNull();
    }
  });

  it('rejects empty and non-URL text', () => {
    for (const url of ['', '   ', 'just words', 'nodot']) {
      expect(normalizeLinkUrl(url)).toBeNull();
    }
  });
});
