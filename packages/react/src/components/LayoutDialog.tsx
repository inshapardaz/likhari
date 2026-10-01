import { useEffect, useState, type FormEvent } from 'react';
import { Button, Group, Modal, NumberInput } from '@mantine/core';
import { useUiStrings } from '../i18n/useStrings';
import { usePortalTarget } from '../PortalTargetContext';

export interface LayoutDialogValue {
  columnCount: number;
}

export interface LayoutDialogProps {
  opened: boolean;
  onSubmit: (value: LayoutDialogValue) => void;
  onClose: () => void;
}

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;
const DEFAULT_COLUMNS = 2;

/** Insert-columns dialog: how many equal-width columns to create. */
export function LayoutDialog({ opened, onSubmit, onClose }: LayoutDialogProps) {
  const strings = useUiStrings();
  const portalTarget = usePortalTarget();
  const [columnCount, setColumnCount] = useState<number>(DEFAULT_COLUMNS);

  useEffect(() => {
    if (!opened) return;
    setColumnCount(DEFAULT_COLUMNS);
  }, [opened]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ columnCount });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={strings.layoutDialog.title} centered size="sm" portalProps={{ target: portalTarget }}>
      <form onSubmit={handleSubmit}>
        <NumberInput
          label={strings.layoutDialog.columnCount}
          min={MIN_COLUMNS}
          max={MAX_COLUMNS}
          value={columnCount}
          onChange={(v) => setColumnCount(typeof v === 'number' ? v : DEFAULT_COLUMNS)}
          data-autofocus
        />
        <Group justify="flex-end" gap="xs" mt="md">
          <Button variant="default" onClick={onClose}>
            {strings.common.cancel}
          </Button>
          <Button type="submit">{strings.common.insert}</Button>
        </Group>
      </form>
    </Modal>
  );
}
