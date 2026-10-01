import { useEffect, useState, type FormEvent } from 'react';
import { Button, Checkbox, Group, Modal, NumberInput } from '@mantine/core';
import { useUiStrings } from '../i18n/useStrings';
import { usePortalTarget } from '../PortalTargetContext';

export interface TableDialogValue {
  rows: number;
  columns: number;
  headerRow: boolean;
}

export interface TableDialogProps {
  opened: boolean;
  onSubmit: (value: TableDialogValue) => void;
  onClose: () => void;
}

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 20;
const DEFAULT_ROWS = 3;
const DEFAULT_COLUMNS = 3;

/**
 * Insert-table dialog: rows x columns and an optional header row. Cell
 * merge/split is intentionally not offered anywhere in this dialog or the
 * table it creates — see the comment on `TablePlugin` in `EditorRoot.tsx`.
 */
export function TableDialog({ opened, onSubmit, onClose }: TableDialogProps) {
  const strings = useUiStrings();
  const portalTarget = usePortalTarget();
  const [rows, setRows] = useState<number>(DEFAULT_ROWS);
  const [columns, setColumns] = useState<number>(DEFAULT_COLUMNS);
  const [headerRow, setHeaderRow] = useState(true);

  useEffect(() => {
    if (!opened) return;
    setRows(DEFAULT_ROWS);
    setColumns(DEFAULT_COLUMNS);
    setHeaderRow(true);
  }, [opened]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ rows, columns, headerRow });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={strings.tableDialog.title} centered size="sm" portalProps={{ target: portalTarget }}>
      <form onSubmit={handleSubmit}>
        <Group grow align="flex-end">
          <NumberInput
            label={strings.tableDialog.rows}
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            value={rows}
            onChange={(v) => setRows(typeof v === 'number' ? v : DEFAULT_ROWS)}
            data-autofocus
          />
          <NumberInput
            label={strings.tableDialog.columns}
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            value={columns}
            onChange={(v) => setColumns(typeof v === 'number' ? v : DEFAULT_COLUMNS)}
          />
        </Group>
        <Checkbox mt="sm" label={strings.tableDialog.headerRow} checked={headerRow} onChange={(e) => setHeaderRow(e.currentTarget.checked)} />
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
