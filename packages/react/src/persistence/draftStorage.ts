/**
 * Autosave-to-localStorage drafts (lexical-editor-spec.md §6.2), namespaced
 * by `documentId` (§6.1). Every function is a no-op (never throws) when
 * `localStorage` is unavailable (SSR, privacy mode) or the stored value is
 * corrupt — autosave is best-effort, never a hard dependency.
 */

const KEY_PREFIX = 'likhari:draft:';

export interface StoredDraft {
  /** Lexical JSON (as produced by `EditorState.toJSON()`, stringified). */
  json: string;
  /** `Date.now()` at write time — lets a host distinguish a stale draft from a genuinely recent one. */
  savedAt: number;
  /** Bumped only if the stored shape itself changes; lets old drafts be recognised/discarded across an upgrade. */
  version: 1;
}

export function draftKey(documentId: string): string {
  return `${KEY_PREFIX}${documentId}`;
}

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some browsers throw on accessing localStorage in certain privacy modes.
    return null;
  }
}

export function readDraft(documentId: string): StoredDraft | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(draftKey(documentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof parsed.json !== 'string' || typeof parsed.savedAt !== 'number' || parsed.version !== 1) return null;
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

/**
 * Best-effort debounced write. Silently skips (rather than throwing) when
 * `json` exceeds `maxBytes` — localStorage has a shared ~5-10MB per-origin
 * ceiling (§6.2), so a single large document (e.g. embedded base64 images)
 * must not be allowed to autosave past a caller-configured limit — or when
 * the write itself fails (quota exceeded, privacy mode).
 */
export function writeDraft(documentId: string, json: string, maxBytes: number): void {
  const storage = getLocalStorage();
  if (!storage) return;
  // .length (UTF-16 code units) over-estimates UTF-8 byte size for any
  // non-Latin text, which only makes this check more conservative — fine
  // for a soft cap that doesn't need to be exact.
  if (json.length > maxBytes) return;
  const draft: StoredDraft = { json, savedAt: Date.now(), version: 1 };
  try {
    storage.setItem(draftKey(documentId), JSON.stringify(draft));
  } catch {
    // Quota exceeded or similar — autosave is best-effort.
  }
}

export function clearDraft(documentId: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(draftKey(documentId));
  } catch {
    // ignore
  }
}
