/** Words sorted once, so every prefix lookup is a binary search rather than a scan. */
export class WordIndex {
  private readonly words: string[];

  constructor(words: Iterable<string>) {
    this.words = [...new Set(words)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * Completions for a prefix: words that start with it (other than the prefix
   * itself), shortest first, then alphabetical. Only the first `scanLimit`
   * matches are considered, so a one-letter prefix stays quick.
   */
  complete(prefix: string, limit = 5, scanLimit = 500): string[] {
    if (prefix === '') return [];
    const matches: string[] = [];
    for (let i = this.lowerBound(prefix); i < this.words.length && matches.length < scanLimit; i++) {
      const word = this.words[i];
      if (!word.startsWith(prefix)) break;
      if (word !== prefix) matches.push(word);
    }
    matches.sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return matches.slice(0, limit);
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
