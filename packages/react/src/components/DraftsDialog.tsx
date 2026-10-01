import { useEffect, useState } from 'react';
import { Badge, Button, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  clearDraft,
  createDraftId,
  hasDraftContent,
  isGeneratedDraftId,
  listDrafts,
  writeDraft,
  type DraftEntry,
} from '../persistence/draftStorage';
import { applyDraftToEditor, formatDraftTime } from '../persistence/draftUi';
import { useUiStrings } from '../i18n/useStrings';
import { usePortalTarget } from '../PortalTargetContext';
import type { Locale } from '../i18n';

/** What the toolbar needs to offer the drafts list. */
export interface DraftsToolbarOptions {
  /** The key this editor's own autosave writes to. */
  currentId: string;
  /** Size cap for archiving the content a restore replaces. */
  maxBytes: number;
  /** Without a `documentId`, a restored draft becomes this editor's draft, so later edits update it instead of duplicating it. */
  adoptOnRestore: boolean;
  onRestored: (entry: DraftEntry) => void;
}

export interface DraftsDialogProps extends DraftsToolbarOptions {
  opened: boolean;
  locale: Locale;
  onClose: () => void;
}

type Pending = { id: string; action: 'restore' | 'delete' };

/**
 * Every autosaved draft in this browser (all documents, and the earlier
 * versions kept when a restore prompt was ignored), newest first, each with
 * Restore and Delete. Restoring over content that differs asks first, and keeps
 * the replaced content as a draft of its own, so nothing is lost either way.
 */
export function DraftsDialog({ opened, locale, currentId, maxBytes, adoptOnRestore, onRestored, onClose }: DraftsDialogProps) {
  const [editor] = useLexicalComposerContext();
  const strings = useUiStrings();
  const portalTarget = usePortalTarget();
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    if (opened) {
      setEntries(listDrafts());
      setPending(null);
    }
  }, [opened]);

  const currentJson = () => JSON.stringify(editor.getEditorState().toJSON());

  const restore = (entry: DraftEntry) => {
    const before = currentJson();
    // Keep what is being replaced, as a draft of its own.
    if (before !== entry.draft.json && hasDraftContent(before)) {
      writeDraft(createDraftId(), before, maxBytes, currentId);
      if (adoptOnRestore) clearDraft(currentId);
    }
    if (applyDraftToEditor(editor, entry.draft.json)) {
      onRestored(entry);
      onClose();
    }
  };

  const requestRestore = (entry: DraftEntry) => {
    const before = currentJson();
    // Replacing real, different content is confirmed first (inline, not a window.confirm).
    if (before !== entry.draft.json && hasDraftContent(before)) setPending({ id: entry.id, action: 'restore' });
    else restore(entry);
  };

  const remove = (entry: DraftEntry) => {
    clearDraft(entry.id);
    setEntries(listDrafts());
    setPending(null);
  };

  const label = (entry: DraftEntry): string => {
    const source = entry.draft.sourceId;
    if (source) return isGeneratedDraftId(source) ? strings.drafts.earlierUntitled : strings.drafts.earlierVersionOf(source);
    return isGeneratedDraftId(entry.id) ? strings.drafts.untitled : strings.drafts.documentLabel(entry.id);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={strings.drafts.dialogTitle}
      centered
      size="lg"
      portalProps={portalTarget ? { target: portalTarget } : undefined}
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {strings.drafts.intro}
        </Text>
        {entries.length === 0 && <Text size="sm">{strings.drafts.empty}</Text>}
        {entries.map((entry) => {
          const isCurrent = entry.id === currentId;
          const isPending = pending?.id === entry.id;
          return (
            <Paper key={entry.id} withBorder p="sm" radius="sm" data-draft-id={entry.id}>
              <Stack gap={6}>
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Text size="sm" lineClamp={2} style={{ flex: 1, wordBreak: 'break-word' }}>
                    {entry.draft.preview || strings.drafts.noText}
                  </Text>
                  {isCurrent && <Badge variant="light">{strings.drafts.thisDocument}</Badge>}
                </Group>
                <Text size="xs" c="dimmed">
                  {label(entry)} · {strings.drafts.savedAt(formatDraftTime(entry.draft.savedAt, locale))} ·{' '}
                  {strings.drafts.size(Math.max(1, Math.round(entry.draft.json.length / 1024)))}
                </Text>
                {!isCurrent &&
                  (isPending ? (
                    <Group gap="xs" align="center">
                      <Text size="sm">{pending.action === 'restore' ? strings.drafts.replacePrompt : strings.drafts.deletePrompt}</Text>
                      <Button
                        size="compact-sm"
                        color={pending.action === 'delete' ? 'red' : undefined}
                        onClick={() => (pending.action === 'restore' ? restore(entry) : remove(entry))}
                      >
                        {pending.action === 'restore' ? strings.drafts.replace : strings.drafts.delete}
                      </Button>
                      <Button size="compact-sm" variant="default" onClick={() => setPending(null)}>
                        {strings.common.cancel}
                      </Button>
                    </Group>
                  ) : (
                    <Group gap="xs">
                      <Button size="compact-sm" onClick={() => requestRestore(entry)}>
                        {strings.drafts.restore}
                      </Button>
                      <Button size="compact-sm" variant="subtle" color="red" onClick={() => setPending({ id: entry.id, action: 'delete' })}>
                        {strings.drafts.delete}
                      </Button>
                    </Group>
                  ))}
              </Stack>
            </Paper>
          );
        })}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {strings.drafts.close}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
