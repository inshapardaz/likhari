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
  /** Stay on the page (also Escape, the close button, and clicking outside). */
  onStay: () => void;
}

/**
 * The in-editor popup behind `EditorRef.confirmDiscard()`: what to do with
 * unsaved changes before leaving. It replaces `window.confirm()`, which can't
 * be styled, translated per editor, or offer more than OK/Cancel. (The browser's
 * own tab-close prompt can't be replaced — see `navigationGuard`.)
 */
export function LeaveDialog({ opened, canSave, canSaveDraft, draftFailed, onSave, onSaveDraft, onDiscard, onStay }: LeaveDialogProps) {
  const strings = useUiStrings();
  const portalTarget = usePortalTarget();
  return (
    <Modal
      opened={opened}
      onClose={onStay}
      title={strings.leaveDialog.title}
      centered
      size="md"
      portalProps={portalTarget ? { target: portalTarget } : undefined}
    >
      <Stack gap="md">
        <Text size="sm">{strings.leaveDialog.message}</Text>
        {draftFailed && (
          <Alert color="red" variant="light" p="xs">
            {strings.leaveDialog.saveDraftFailed}
          </Alert>
        )}
        <Group justify="flex-end" gap="xs" wrap="wrap">
          <Button variant="default" onClick={onStay} data-autofocus>
            {strings.leaveDialog.stay}
          </Button>
          <Button variant="subtle" color="red" onClick={onDiscard}>
            {strings.leaveDialog.discard}
          </Button>
          {canSaveDraft && (
            <Button variant="default" onClick={onSaveDraft}>
              {strings.leaveDialog.saveDraft}
            </Button>
          )}
          {canSave && <Button onClick={onSave}>{strings.leaveDialog.save}</Button>}
        </Group>
      </Stack>
    </Modal>
  );
}
