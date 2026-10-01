import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, draftKey, readDraft, writeDraft } from './draftStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('draftKey', () => {
  it('namespaces by documentId', () => {
    expect(draftKey('doc-1')).toBe('likhari:draft:doc-1');
  });
});

describe('writeDraft / readDraft', () => {
  it('round-trips a draft with a timestamp and version marker', () => {
    expect(writeDraft('doc-1', '{"root":{}}', 1_000_000)).toBe(true);
    const draft = readDraft('doc-1');
    expect(draft?.json).toBe('{"root":{}}');
    expect(draft?.version).toBe(1);
    expect(draft?.savedAt).toBeGreaterThan(0);
  });

  it('returns null when nothing was ever written', () => {
    expect(readDraft('never-written')).toBeNull();
  });

  it('does not write a draft larger than maxBytes', () => {
    expect(writeDraft('doc-1', 'x'.repeat(100), 10)).toBe(false);
    expect(readDraft('doc-1')).toBeNull();
  });

  it('ignores a corrupt stored value instead of throwing', () => {
    localStorage.setItem(draftKey('doc-1'), 'not json');
    expect(readDraft('doc-1')).toBeNull();
  });

  it('ignores a stored value missing required fields', () => {
    localStorage.setItem(draftKey('doc-1'), JSON.stringify({ json: '{}' }));
    expect(readDraft('doc-1')).toBeNull();
  });

  it('keeps drafts for different documentIds independent', () => {
    writeDraft('doc-1', '{"a":1}', 1_000_000);
    writeDraft('doc-2', '{"b":2}', 1_000_000);
    expect(readDraft('doc-1')?.json).toBe('{"a":1}');
    expect(readDraft('doc-2')?.json).toBe('{"b":2}');
  });
});

describe('clearDraft', () => {
  it('removes a stored draft', () => {
    writeDraft('doc-1', '{"a":1}', 1_000_000);
    clearDraft('doc-1');
    expect(readDraft('doc-1')).toBeNull();
  });

  it('is a no-op when nothing was stored', () => {
    expect(() => clearDraft('never-written')).not.toThrow();
  });
});

import { archiveDraft, createDraftId, extractPreview, hasDraftContent, isGeneratedDraftId, listDrafts, pruneDrafts } from './draftStorage';

const doc = (...paragraphs: string[]) =>
  JSON.stringify({
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({ type: 'paragraph', children: text ? [{ type: 'text', text }] : [] })),
    },
  });

describe('createDraftId', () => {
  it('returns a different, recognisable id every time', () => {
    const a = createDraftId();
    const b = createDraftId();
    expect(a).not.toBe(b);
    expect(isGeneratedDraftId(a)).toBe(true);
    expect(isGeneratedDraftId('my-document')).toBe(false);
  });
});

describe('extractPreview / hasDraftContent', () => {
  it('joins the text of all blocks onto one line', () => {
    expect(extractPreview(doc('Hello  world', '', 'Second'))).toBe('Hello world Second');
  });

  it('truncates a long document', () => {
    const preview = extractPreview(doc('word '.repeat(100)));
    expect(preview.length).toBeLessThan(150);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('treats a blank document as having no content, and an image as content', () => {
    expect(hasDraftContent(doc('', '  '))).toBe(false);
    expect(hasDraftContent(doc('hi'))).toBe(true);
    expect(hasDraftContent(JSON.stringify({ root: { type: 'root', children: [{ type: 'image', altText: 'a cat' }] } }))).toBe(true);
    expect(hasDraftContent('not json')).toBe(false);
  });
});

describe('listDrafts', () => {
  it('lists every draft newest first, ignoring other keys and corrupt values', () => {
    localStorage.setItem('unrelated', 'x');
    localStorage.setItem('likhari:draft:corrupt', '{nope');
    writeDraft('a', doc('first'), 1_000_000);
    const stored = JSON.parse(localStorage.getItem('likhari:draft:a') as string);
    localStorage.setItem('likhari:draft:a', JSON.stringify({ ...stored, savedAt: 1000 }));
    writeDraft('b', doc('second'), 1_000_000);
    const list = listDrafts();
    expect(list.map((e) => e.id)).toEqual(['b', 'a']);
    expect(list[0].draft.preview).toBe('second');
  });
});

describe('archiveDraft', () => {
  it('copies a draft to a new id and remembers where it came from', () => {
    writeDraft('doc-1', doc('keep me'), 1_000_000);
    const archivedId = archiveDraft('doc-1');
    expect(archivedId).not.toBeNull();
    expect(archivedId).not.toBe('doc-1');
    expect(readDraft(archivedId as string)?.sourceId).toBe('doc-1');
    expect(readDraft(archivedId as string)?.json).toBe(readDraft('doc-1')?.json);
  });

  it('returns null when there is nothing to archive', () => {
    expect(archiveDraft('missing')).toBeNull();
  });
});

describe('pruneDrafts', () => {
  it('removes the oldest drafts beyond the limit but never a protected one', () => {
    for (const [i, id] of ['old', 'mid', 'new'].entries()) {
      writeDraft(id, doc(id), 1_000_000);
      const stored = JSON.parse(localStorage.getItem(`likhari:draft:${id}`) as string);
      localStorage.setItem(`likhari:draft:${id}`, JSON.stringify({ ...stored, savedAt: (i + 1) * 1000 }));
    }
    pruneDrafts(2, ['old']);
    expect(listDrafts().map((e) => e.id).sort()).toEqual(['new', 'old']);
  });
});
