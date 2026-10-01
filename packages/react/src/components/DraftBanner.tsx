import { useState } from 'react';
import { IconHistory } from '@tabler/icons-react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { archiveDraft, clearDraft, hasDraftContent, readDraft, type DraftEntry, type StoredDraft } from '../persistence/draftStorage';
import { applyDraftToEditor, formatDraftTime } from '../persistence/draftUi';
import { useUiStrings } from '../i18n/useStrings';
import type { Locale } from '../i18n';

export interface DraftBannerProps {
  /** The host's `documentId` — the key the draft is stored under. */
  draftId: string;
  /** The Lexical JSON the editor started with; a draft identical to it isn't offered. */
  initialJson?: string;
  locale: Locale;
  onRestored: (entry: DraftEntry) => void;
}

/**
 * Shown on mount when a draft of this document newer than the initial content
 * is found (lexical-editor-spec.md §6.2). It never picks one silently: the
 * user can Restore it, Ignore it (it is kept in the drafts list, since new
 * edits would otherwise overwrite it), or Remove it.
 */
export function DraftBanner({ draftId, initialJson, locale, onRestored }: DraftBannerProps) {
  const [editor] = useLexicalComposerContext();
  const strings = useUiStrings();
  const [draft, setDraft] = useState<StoredDraft | null>(() => {
    const stored = readDraft(draftId);
    return stored && hasDraftContent(stored.json) && stored.json !== initialJson ? stored : null;
  });

  if (!draft) return null;

  const restore = () => {
    if (applyDraftToEditor(editor, draft.json)) onRestored({ id: draftId, draft });
    // A corrupt or incompatible draft can't be restored: drop the banner and keep the initial content.
    setDraft(null);
  };

  const ignore = () => {
    // Move it aside, so edits from here on can't overwrite it unseen.
    if (archiveDraft(draftId)) clearDraft(draftId);
    setDraft(null);
  };

  const remove = () => {
    clearDraft(draftId);
    setDraft(null);
  };

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
