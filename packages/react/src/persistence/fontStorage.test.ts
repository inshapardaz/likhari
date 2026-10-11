import { beforeEach, describe, expect, it } from 'vitest';
import { readFontSettings, writeFontSettings } from './fontStorage';

describe('fontStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips settings for a document', () => {
    writeFontSettings({ fontFamily: 'Amiri', zoom: 150 }, 'doc-1');
    expect(readFontSettings('doc-1')).toEqual({ fontFamily: 'Amiri', zoom: 150 });
  });

  it('keeps documents apart, with a shared slot for editors without an id', () => {
    writeFontSettings({ zoom: 125 }, 'doc-1');
    writeFontSettings({ zoom: 75 });
    expect(readFontSettings('doc-1')).toEqual({ zoom: 125 });
    expect(readFontSettings()).toEqual({ zoom: 75 });
    expect(readFontSettings('other')).toEqual({});
  });

  it('ignores corrupt or wrongly typed data', () => {
    localStorage.setItem('likhari:font:_', '{not json');
    expect(readFontSettings()).toEqual({});
    localStorage.setItem('likhari:font:_', JSON.stringify({ fontFamily: 5, zoom: 'big' }));
    expect(readFontSettings()).toEqual({});
  });
});
