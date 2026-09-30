import { describe, expect, it } from 'vitest';
import { normalizeLinkUrl, splitPastedText } from './linkUrl';

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

describe('splitPastedText', () => {
  it('returns a single link for a bare URL', () => {
    expect(splitPastedText('https://example.com/a?b=1')).toEqual([
      { type: 'link', text: 'https://example.com/a?b=1', url: 'https://example.com/a?b=1' },
    ]);
  });

  it('treats www. and mailto: as links, adding https:// to www.', () => {
    expect(splitPastedText('www.example.com')).toEqual([{ type: 'link', text: 'www.example.com', url: 'https://www.example.com' }]);
    expect(splitPastedText('mailto:a@b.com')).toEqual([{ type: 'link', text: 'mailto:a@b.com', url: 'mailto:a@b.com' }]);
  });

  it('finds links inside a sentence and keeps trailing punctuation as text', () => {
    expect(splitPastedText('See https://a.com/x, then (https://b.org).')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'https://a.com/x', url: 'https://a.com/x' },
      { type: 'text', text: ', then (' },
      { type: 'link', text: 'https://b.org', url: 'https://b.org' },
      { type: 'text', text: ').' },
    ]);
  });

  it('leaves bare domains, filenames and plain prose as text', () => {
    for (const text of ['example.com', 'notes.txt', 'just some words']) {
      expect(splitPastedText(text)).toEqual([{ type: 'text', text }]);
    }
  });

  it('does not link scripts or other schemes', () => {
    expect(splitPastedText('javascript:alert(1)')).toEqual([{ type: 'text', text: 'javascript:alert(1)' }]);
    expect(splitPastedText('ftp://a.com')).toEqual([{ type: 'text', text: 'ftp://a.com' }]);
  });
});
