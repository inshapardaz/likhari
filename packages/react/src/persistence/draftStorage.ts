/**
 * Autosave-to-localStorage drafts (lexical-editor-spec.md §6.2). Each draft is
 * keyed by an id: the host's `documentId` when it gives one (§6.1), otherwise
 * a generated unique id, so editors without a `documentId` never overwrite each
 * other's drafts. Every function is a no-op (never throws) when `localStorage`
 * is unavailable (SSR, privacy mode) or a stored value is corrupt — autosave is
 * best-effort, never a hard dependency.
 */

const KEY_PREFIX = 'likhari:draft:';
const PREVIEW_LENGTH = 140;

export interface StoredDraft {
  /** Lexical JSON (as produced by `EditorState.toJSON()`, stringified). */
  json: string;
  /** `Date.now()` at write time — lets a host distinguish a stale draft from a genuinely recent one. */
  savedAt: number;
  /** Bumped only if the stored shape itself changes; lets old drafts be recognised/discarded across an upgrade. */
  version: 1;
  /** First words of the text, for listing drafts without parsing every document. */
  preview?: string;
  /** Set on a draft archived from `documentId` (the id it was an earlier version of). */
  sourceId?: string;
}

export interface DraftEntry {
  id: string;
  draft: StoredDraft;
}

export function draftKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

/** A new unique id for a draft whose editor has no `documentId`. */
export function createDraftId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through to the non-crypto id
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Whether an id came from createDraftId() rather than a host's `documentId`. */
export function isGeneratedDraftId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^draft-[0-9a-z]+-[0-9a-z]+$/.test(id);
}

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some browsers throw on accessing localStorage in certain privacy modes.
    return null;
  }
}

interface SerializedNodeLike {
  type?: string;
  text?: string;
  altText?: string;
  children?: SerializedNodeLike[];
}

function collectText(node: SerializedNodeLike, parts: string[], state: { hasContent: boolean }): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    if (node.text.trim()) state.hasContent = true;
    parts.push(node.text);
  } else if (node.type === 'linebreak') {
    parts.push(' ');
  } else if (node.type === 'image') {
    state.hasContent = true;
    if (node.altText) parts.push(`[${node.altText}]`);
  }
  for (const child of node.children ?? []) collectText(child, parts, state);
  // Block boundaries read as a space in a one-line preview.
  if (node.children && node.type !== 'root') parts.push(' ');
}

function summarize(json: string): { preview: string; hasContent: boolean } {
  try {
    const root = (JSON.parse(json) as { root?: SerializedNodeLike }).root;
    if (!root) return { preview: '', hasContent: false };
    const parts: string[] = [];
    const state = { hasContent: false };
    collectText(root, parts, state);
    const text = parts.join('').replace(/\s+/g, ' ').trim();
    const preview = text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : text;
    return { preview, hasContent: state.hasContent };
  } catch {
    return { preview: '', hasContent: false };
  }
}

/** One-line text preview of a Lexical JSON document ('' when it has no text). */
export function extractPreview(json: string): string {
  return summarize(json).preview;
}

/** Whether a Lexical JSON document has any text or image (a blank one isn't worth a draft). */
export function hasDraftContent(json: string): boolean {
  return summarize(json).hasContent;
}

function parseDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof parsed.json !== 'string' || typeof parsed.savedAt !== 'number' || parsed.version !== 1) return null;
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

export function readDraft(id: string): StoredDraft | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return parseDraft(storage.getItem(draftKey(id)));
  } catch {
    return null;
  }
}

/**
 * Best-effort write. Silently skips (rather than throwing) when `json` exceeds
 * `maxBytes` — localStorage has a shared ~5-10MB per-origin ceiling (§6.2), so a
 * single large document (e.g. embedded base64 images) must not be allowed to
 * autosave past a caller-configured limit — or when the write itself fails
 * (quota exceeded, privacy mode).
 */
export function writeDraft(id: string, json: string, maxBytes: number, sourceId?: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  // .length (UTF-16 code units) over-estimates UTF-8 byte size for any
  // non-Latin text, which only makes this check more conservative — fine
  // for a soft cap that doesn't need to be exact.
  if (json.length > maxBytes) return;
  const draft: StoredDraft = { json, savedAt: Date.now(), version: 1, preview: extractPreview(json) };
  if (sourceId) draft.sourceId = sourceId;
  try {
    storage.setItem(draftKey(id), JSON.stringify(draft));
  } catch {
    // Quota exceeded or similar — autosave is best-effort.
  }
}

export function clearDraft(id: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(draftKey(id));
  } catch {
    // ignore
  }
}

/** Every stored draft, newest first. */
export function listDrafts(): DraftEntry[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  const entries: DraftEntry[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const draft = parseDraft(storage.getItem(key));
      if (draft) entries.push({ id: key.slice(KEY_PREFIX.length), draft });
    }
  } catch {
    return entries;
  }
  return entries.sort((a, b) => b.draft.savedAt - a.draft.savedAt);
}

/**
 * Keeps a draft that is about to be overwritten or ignored: copies it to a new
 * generated id (remembering `sourceId`) so it stays in the drafts list.
 * Returns the new id, or null if nothing could be copied.
 */
export function archiveDraft(id: string): string | null {
  const storage = getLocalStorage();
  const draft = readDraft(id);
  if (!storage || !draft) return null;
  const archivedId = createDraftId();
  try {
    storage.setItem(draftKey(archivedId), JSON.stringify({ ...draft, sourceId: draft.sourceId ?? id }));
    return archivedId;
  } catch {
    return null;
  }
}

/** Deletes the oldest drafts beyond `max`, never touching `keepIds`. */
export function pruneDrafts(max: number, keepIds: string[] = []): void {
  if (max < 1) return;
  const removable = listDrafts().filter((entry) => !keepIds.includes(entry.id));
  const kept = listDrafts().length - removable.length;
  const excess = removable.length + kept - max;
  if (excess <= 0) return;
  // removable is newest first, so the oldest are at the end.
  for (const entry of removable.slice(-excess)) clearDraft(entry.id);
}
