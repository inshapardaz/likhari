import { useEffect, useRef, useState } from 'react';
import { IconHistory } from '@tabler/icons-react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { archiveDraft, clearDraft, hasDraftContent, readDraft, type DraftEntry, type StoredDraft } from '../persistence/draftStorage';
import { applyDraftToEditor, formatDraftTime } from '../persistence/draftUi';
import { useUiStrings } from '../i18n/useStrings';
import type { Locale } from '../i18n';

/** What to do on mount with a stored draft of this document that is newer than the initial content. */
export type DraftRestoreMode = 'prompt' | 'auto' | 'off';

export interface DraftRestoreProps {
  /** The host's `documentId` — the key the draft is stored under. */
  draftId: string;
  mode: DraftRestoreMode;
  /** The Lexical JSON the editor started with; a draft identical to it isn't offered. */
  initialJson?: string;
  locale: Locale;
  onRestored: (entry: DraftEntry) => void;
}

/**
 * On mount, handles a draft of this document newer than the initial content
 * (lexical-editor-spec.md §6.2), per `mode`:
 * - `prompt` (default): a banner — Restore, Ignore (kept in the drafts list,
 *   since new edits would otherwise overwrite it) or Remove. Never picks silently.
 * - `auto`: loads the draft straight away, no banner.
 * - `off`: leaves the editor on its initial content, but moves the draft aside
 *   as an earlier version so new edits can't overwrite it unseen.
 */
export function DraftRestore({ draftId, mode, initialJson, locale, onRestored }: DraftRestoreProps) {
  const [editor] = useLexicalComposerContext();
  const strings = useUiStrings();
  const [draft, setDraft] = useState<StoredDraft | null>(() => {
    const stored = readDraft(draftId);
    return stored && hasDraftContent(stored.json) && stored.json !== initialJson ? stored : null;
  });

  const handled = useRef(false);

  const restore = () => {
    if (!draft) return;
    if (applyDraftToEditor(editor, draft.json)) onRestored({ id: draftId, draft });
    // A corrupt or incompatible draft can't be restored: drop the banner and keep the initial content.
    setDraft(null);
  };

  const ignore = () => {
    // Move it aside, so edits from here on can't overwrite it unseen.
    if (archiveDraft(draftId)) clearDraft(draftId);
    setDraft(null);
  };

  // Non-interactive modes act once, on mount.
  useEffect(() => {
    if (handled.current || !draft) return;
    handled.current = true;
    if (mode === 'auto') restore();
    else if (mode === 'off') ignore();
    // Deliberately runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = () => {
    clearDraft(draftId);
    setDraft(null);
  };

  if (!draft || mode !== 'prompt') return null;

  // Plain elements styled with the editor's own tokens (editor.css): Mantine's
  // theme variables are scoped to the portal target, so an in-flow Mantine
  // button here would fall back to Mantine's default blue.
  return (
    <div className="likhari-draft-banner" role="status" aria-live="polite">
      <div className="likhari-draft-banner-message">
        <IconHistory size={18} stroke={1.75} aria-hidden="true" />
        <span>{strings.drafts.bannerMessage(formatDraftTime(draft.savedAt, locale))}</span>
      </div>
      <div className="likhari-draft-banner-actions">
        <button type="button" className="likhari-draft-banner-button" data-variant="primary" onClick={restore}>
          {strings.drafts.restore}
        </button>
        <button type="button" className="likhari-draft-banner-button" onClick={ignore}>
          {strings.drafts.ignore}
        </button>
        <button type="button" className="likhari-draft-banner-button" data-variant="danger" onClick={remove}>
          {strings.drafts.remove}
        </button>
      </div>
    </div>
  );
}
