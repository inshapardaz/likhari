import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, createEditor } from 'lexical';
import { $correctDocument, $correctWordBeforeCaret } from './autoCorrectActions';
import { normalizeUrdu } from '../normalization/urduNormalize';
import {
  apiAutoCorrectStore,
  appendAutoCorrection,
  fileAutoCorrectStore,
  loadAutoCorrections,
  localStorageAutoCorrectStore,
  type AutoCorrectStore,
} from './autoCorrectStores';

function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function memoryStore(id: string, entries: Record<string, Record<string, string>>, writable = true): AutoCorrectStore & { written: unknown[] } {
  const written: unknown[] = [];
  return {
    id,
    readOnly: !writable,
    written,
    async load(language) {
      return Object.entries(entries[language] ?? {}).map(([from, to]) => ({ from, to }));
    },
    ...(writable
      ? {
          async append(language: string, entry: { from: string; to: string }) {
            written.push({ language, ...entry });
          },
        }
      : {}),
  } as AutoCorrectStore & { written: unknown[] };
}

describe('auto-correct stores', () => {
  let originalLocalStorage: unknown;
  beforeEach(() => {
    originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = fakeLocalStorage();
  });
  afterEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
  });

  it('keeps appended corrections in local storage, per language', async () => {
    const store = localStorageAutoCorrectStore();
    await store.append!('en', { from: 'teh', to: 'the' });
    await store.append!('ur', { from: 'ک', to: 'ک' });
    expect(await store.load('en')).toEqual([{ from: 'teh', to: 'the' }]);
    expect(await store.load('pa-shahmukhi')).toEqual([]);
  });

  it('treats broken local storage as no corrections', async () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('quota');
      },
    };
    const store = localStorageAutoCorrectStore();
    expect(await store.load('en')).toEqual([]);
    await expect(store.append!('en', { from: 'a', to: 'b' })).resolves.toBeUndefined();
  });

  it('loads from an API with the language in the query, and posts new corrections', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init?.method === 'POST') return new Response(null, { status: 201 });
      return new Response(JSON.stringify([{ from: 'teh', to: 'the' }]), { status: 200 });
    }) as typeof fetch;
    const store = apiAutoCorrectStore({ url: 'https://api.example/corrections', fetch: fakeFetch });
    expect(await store.load('en')).toEqual([{ from: 'teh', to: 'the' }]);
    expect(calls[0].url).toBe('https://api.example/corrections?language=en');
    await store.append!('en', { from: 'adn', to: 'and' });
    expect(calls[1].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ language: 'en', from: 'adn', to: 'and' });
  });

  it('reads a published file and never writes to it', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify([{ language: 'en', from: 'teh', to: 'the' }, { language: 'ur', from: 'x', to: 'y' }]))) as typeof fetch;
    const store = fileAutoCorrectStore({ url: '/corrections.json', fetch: fakeFetch });
    expect(store.readOnly).toBe(true);
    expect(store.append).toBeUndefined();
    expect(await store.load('en')).toEqual([{ from: 'teh', to: 'the' }]);
  });

  it('merges stores with the first listed winning a clash, and skips a store that fails', async () => {
    const failing: AutoCorrectStore = {
      id: 'down',
      async load() {
        throw new Error('offline');
      },
    };
    const table = await loadAutoCorrections(
      [memoryStore('first', { en: { teh: 'the' } }), failing, memoryStore('second', { en: { teh: 'tea', adn: 'and' } })],
      'en',
    );
    expect(table.get('teh')).toBe('the');
    expect(table.get('adn')).toBe('and');
  });

  it('appends to the first store that accepts writes, and reports when none does', async () => {
    const readOnly = memoryStore('file', {}, false);
    const writable = memoryStore('local', {});
    expect(await appendAutoCorrection([readOnly, writable], 'en', { from: 'teh', to: 'the' })).toBe(true);
    expect(writable.written).toEqual([{ language: 'en', from: 'teh', to: 'the' }]);
    expect(await appendAutoCorrection([readOnly], 'en', { from: 'a', to: 'b' })).toBe(false);
  });
});

describe('$correctWordBeforeCaret', () => {
  function editorWith(text: string, caret: number) {
    const editor = createEditor({
      namespace: 'autocorrect-test',
      onError: (e) => {
        throw e;
      },
    });
    let textNodeKey = '';
    editor.update(
      () => {
        const node = $createTextNode(text);
        textNodeKey = node.getKey();
        $getRoot().clear().append($createParagraphNode().append(node));
        node.select(caret, caret);
      },
      { discrete: true },
    );
    return { editor, textNodeKey };
  }

  it('replaces the word before a typed space and keeps the caret after the space', () => {
    const { editor } = editorWith('teh ', 4);
    let corrected = false;
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(4, 4);
        corrected = $correctWordBeforeCaret(new Map([['teh', 'the']]));
      },
      { discrete: true },
    );
    expect(corrected).toBe(true);
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('the ');
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.anchor.offset).toBe(4);
    });
  });

  it('leaves a word alone when there is no typed boundary or no correction', () => {
    const { editor } = editorWith('teh', 3);
    let corrected = true;
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(3, 3);
        corrected = $correctWordBeforeCaret(new Map([['teh', 'the']]));
      },
      { discrete: true },
    );
    expect(corrected).toBe(false);
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('teh');
  });
});

describe('$correctDocument', () => {
  it('corrects every word, including one split across formatted text, and counts them', () => {
    const editor = createEditor({
      namespace: 'correct-document-test',
      onError: (e) => {
        throw e;
      },
    });
    editor.update(
      () => {
        const first = $createParagraphNode();
        const bold = $createTextNode('te');
        bold.toggleFormat('bold');
        first.append(bold, $createTextNode('h cat'));
        $getRoot().clear().append(first, $createParagraphNode().append($createTextNode('teh end')));
      },
      { discrete: true },
    );
    let count = 0;
    editor.update(
      () => {
        count = $correctDocument(new Map([['teh', 'the']]), new Map());
      },
      { discrete: true },
    );
    expect(count).toBe(2);
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('the cat\n\nthe end');
  });
});

describe('auto-correct with Urdu normalisation', () => {
  it('normalises the word before the caret before looking it up', () => {
    const editor = createEditor({
      namespace: 'normalise-test',
      onError: (e) => {
        throw e;
      },
    });
    editor.update(
      () => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('ﮔیا ')));
      },
      { discrete: true },
    );
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0].select(4, 4);
        $correctWordBeforeCaret(new Map(), (word) => normalizeUrdu(word));
      },
      { discrete: true },
    );
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('گیا ');
  });
});
