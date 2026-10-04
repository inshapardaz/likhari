/**
 * Completion words, sorted once so every prefix lookup is a binary search. Each
 * word has a count of how often it was accepted as a completion; more used words
 * are suggested first.
 */
export class WordIndex {
  private readonly words: string[];
  private readonly counts: Map<string, number>;

  constructor(words: Iterable<string>, counts: Record<string, number> = {}) {
    this.counts = new Map(Object.entries(counts));
    this.words = [...new Set([...words, ...this.counts.keys()])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * Completions for a prefix: words that start with it (other than the prefix
   * itself), most accepted first, then shortest, then alphabetical. Only the first
   * `scanLimit` matches of the sorted words are scanned, so a one-letter prefix stays
   * quick; words with a count are always considered.
   */
  complete(prefix: string, limit = 5, scanLimit = 500): string[] {
    if (prefix === '') return [];
    const candidates = new Set<string>();
    for (let i = this.lowerBound(prefix), scanned = 0; i < this.words.length && scanned < scanLimit; i++) {
      const word = this.words[i];
      if (!word.startsWith(prefix)) break;
      if (word !== prefix) candidates.add(word);
      scanned += 1;
    }
    for (const word of this.counts.keys()) if (word !== prefix && word.startsWith(prefix)) candidates.add(word);

    return [...candidates]
      .sort((a, b) => (this.countOf(b) - this.countOf(a)) || a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, limit);
  }

  private countOf(word: string): number {
    return this.counts.get(word) ?? 0;
  }

  private lowerBound(prefix: string): number {
    let low = 0;
    let high = this.words.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.words[mid] < prefix) low = mid + 1;
      else high = mid;
    }
    return low;
  }
}
