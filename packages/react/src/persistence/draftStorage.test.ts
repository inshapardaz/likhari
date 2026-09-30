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
    writeDraft('doc-1', '{"root":{}}', 1_000_000);
    const draft = readDraft('doc-1');
    expect(draft?.json).toBe('{"root":{}}');
    expect(draft?.version).toBe(1);
    expect(draft?.savedAt).toBeGreaterThan(0);
  });

  it('returns null when nothing was ever written', () => {
    expect(readDraft('never-written')).toBeNull();
  });

  it('does not write a draft larger than maxBytes', () => {
    writeDraft('doc-1', 'x'.repeat(100), 10);
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
