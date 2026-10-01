import type { LexicalEditor } from 'lexical';
import type { Locale } from '../i18n';

/** Replaces the editor's content with a stored draft's Lexical JSON. Returns
 * false (leaving the editor untouched) if the draft is corrupt or from an
 * incompatible node schema, rather than throwing. */
export function applyDraftToEditor(editor: LexicalEditor, json: string): boolean {
  try {
    editor.setEditorState(editor.parseEditorState(json));
    return true;
  } catch {
    return false;
  }
}

const INTL_LOCALES: Record<Locale, string> = { en: 'en', ur: 'ur', 'pa-shahmukhi': 'pa-Arab' };

/** A draft's save time as a short localized date and time. */
export function formatDraftTime(savedAt: number, locale: Locale): string {
  const date = new Date(savedAt);
  try {
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
