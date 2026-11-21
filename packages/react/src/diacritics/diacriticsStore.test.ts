import { describe, expect, it } from 'vitest';
import { loadDiacriticsEntries, loadDiacriticsTable, type DiacriticsStore } from './diacriticsStore';

function fakeStore(id: string, entries: { word: string; vowelled: string }[]): DiacriticsStore {
  return { id, load: async () => entries };
}

describe('loadDiacriticsEntries', () => {
  it('merges stores, the first listed winning a clash', async () => {
    const first = fakeStore('first', [{ word: 'امید', vowelled: 'اُمّید' }]);
    const second = fakeStore('second', [
      { word: 'امید', vowelled: 'wrong' },
      { word: 'دل', vowelled: 'دِل' },
    ]);
    const entries = await loadDiacriticsEntries([first, second], 'ur');
    expect(entries).toEqual([
      { word: 'امید', vowelled: 'اُمّید' },
      { word: 'دل', vowelled: 'دِل' },
    ]);
  });

  it('skips a store that fails to load', async () => {
    const ok = fakeStore('ok', [{ word: 'دل', vowelled: 'دِل' }]);
    const failing: DiacriticsStore = { id: 'failing', load: async () => Promise.reject(new Error('boom')) };
    const entries = await loadDiacriticsEntries([failing, ok], 'ur');
    expect(entries).toEqual([{ word: 'دل', vowelled: 'دِل' }]);
  });
});

describe('loadDiacriticsTable', () => {
  it('thins each entry to the requested level, keyed by the bare word', async () => {
    const store = fakeStore('store', [{ word: 'امید', vowelled: 'اُمّید' }]);
    const minimal = await loadDiacriticsTable([store], 'ur', 'minimal');
    const maximum = await loadDiacriticsTable([store], 'ur', 'maximum');
    expect(minimal.get('امید')).toBe('امّید');
    expect(maximum.get('امید')).toBe('اُمّید');
  });

  it('omits an entry whose thinned form equals the bare word', async () => {
    // At the minimal level, a word whose only diacritic is a short vowel thins to itself.
    const store = fakeStore('store', [{ word: 'دل', vowelled: 'دِل' }]);
    const minimal = await loadDiacriticsTable([store], 'ur', 'minimal');
    expect(minimal.has('دل')).toBe(false);
  });
});
