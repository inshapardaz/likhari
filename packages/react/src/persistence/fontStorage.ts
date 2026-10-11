/**
 * Remembers the uniform font mode's font family and zoom in `localStorage`, so a
 * reader's choice survives a reload. They are a view preference, not document
 * content, so they are stored apart from drafts: under `documentId` when the
 * editor has one, otherwise shared by editors on the page. Every function is a
 * no-op (never throws) when `localStorage` is unavailable or holds bad data.
 */

const KEY_PREFIX = 'likhari:font:';
const SHARED_ID = '_';

export interface StoredFontSettings {
  fontFamily?: string;
  zoom?: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function keyFor(documentId?: string): string {
  return `${KEY_PREFIX}${documentId ?? SHARED_ID}`;
}

export function readFontSettings(documentId?: string): StoredFontSettings {
  try {
    const raw = storage()?.getItem(keyFor(documentId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const { fontFamily, zoom } = parsed as Record<string, unknown>;
    return {
      ...(typeof fontFamily === 'string' && fontFamily !== '' && { fontFamily }),
      ...(typeof zoom === 'number' && Number.isFinite(zoom) && { zoom }),
    };
  } catch {
    return {};
  }
}

export function writeFontSettings(settings: StoredFontSettings, documentId?: string): void {
  try {
    storage()?.setItem(keyFor(documentId), JSON.stringify(settings));
  } catch {
    // Storage full or blocked: the setting still applies for this session.
  }
}
