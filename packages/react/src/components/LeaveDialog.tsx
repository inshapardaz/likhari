import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useUiStrings } from '../i18n/useStrings';
import { usePortalTarget } from '../PortalTargetContext';

export interface LeaveDialogProps {
  opened: boolean;
  /** Offer "Save" (calls the host's `onSave`, then lets the user leave). */
  canSave: boolean;
  /** Offer "Save draft" (keeps the work in this browser, then lets the user leave). */
  canSaveDraft: boolean;
  /** A "Save draft" attempt failed; explains why the dialog is still open. */
  draftFailed: boolean;
  onSave: () => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  /** Cancel: stay on the page. Escape, the close button and clicking outside do the same. */
  onCancel: () => void;
}

/**
 * The in-editor popup behind `EditorRef.confirmDiscard()`: what to do with
 * unsaved changes before leaving. It replaces `window.confirm()`, which can't
 * be styled, translated per editor, or offer more than OK/Cancel. (The browser's
 * own tab-close prompt can't be replaced — see `navigationGuard`.)
 */
export function LeaveDialog({ opened, canSave, canSaveDraft, draftFailed, onSave, onSaveDraft, onDiscard, onCancel }: LeaveDialogProps) {
  const strings = useUiStrings();
  const portalTarget = usePortalTarget();
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={strings.leaveDialog.title}
      centered
      size="lg"
      portalProps={portalTarget ? { target: portalTarget } : undefined}
    >
      <Stack gap="md">
        <Text size="sm">{strings.leaveDialog.message}</Text>
        {draftFailed && (
          <Alert color="red" variant="light" p="xs">
            {strings.leaveDialog.saveDraftFailed}
          </Alert>
        )}
        {/* One row, in this order: Save, Discard, Save draft, Cancel. */}
        <Group justify="flex-end" gap="xs" wrap="nowrap">
          {canSave && (
            <Button size="sm" onClick={onSave}>
              {strings.leaveDialog.save}
            </Button>
          )}
          <Button size="sm" variant="outline" color="red" onClick={onDiscard}>
            {strings.leaveDialog.discard}
          </Button>
          {canSaveDraft && (
            <Button size="sm" variant="default" onClick={onSaveDraft}>
              {strings.leaveDialog.saveDraft}
            </Button>
          )}
          <Button size="sm" variant="default" onClick={onCancel} data-autofocus>
            {strings.common.cancel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
