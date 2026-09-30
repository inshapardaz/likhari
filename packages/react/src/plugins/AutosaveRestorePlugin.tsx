import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { readDraft } from '../persistence/draftStorage';

export interface AutosaveRestorePluginProps {
  documentId?: string;
  enabled: boolean;
  /** The Lexical JSON the editor was constructed with (stringified), or
   * undefined for a blank document — compared against a stored draft so an
   * identical draft doesn't trigger a pointless prompt. */
  initialJson?: string;
  confirmMessage: string;
}

/**
 * On mount, offers to restore a newer localStorage draft over the initial
 * content passed in (lexical-editor-spec.md §6.2) — data-loss prevention is
 * the explicit goal, so this never silently picks one over the other.
 */
export function AutosaveRestorePlugin({ documentId, enabled, initialJson, confirmMessage }: AutosaveRestorePluginProps) {
  const [editor] = useLexicalComposerContext();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !enabled || !documentId) return;
    checked.current = true;

    const draft = readDraft(documentId);
    if (!draft || draft.json === initialJson) return;
    if (typeof window === 'undefined' || !window.confirm(confirmMessage)) return;

    try {
      const parsed = editor.parseEditorState(draft.json);
      editor.setEditorState(parsed);
    } catch {
      // Corrupt or incompatible draft (e.g. from a much older node schema) —
      // ignore it and keep the initial content rather than crashing.
    }
    // Deliberately runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
