import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select } from '@mantine/core';
import { useUiStrings } from '../i18n/useStrings';
import { usePortalTarget } from '../PortalTargetContext';
import type { DictionaryEntry, DictionaryStore } from '../dictionary/dictionaryStores';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';

export interface DictionaryDialogProps {
  opened: boolean;
  word: string;
  language: SpellLanguage;
  /** Dictionaries the user can pick from; the first is used first. */
  stores: DictionaryStore[];
  onClose: () => void;
}

/**
 * Right-click "Look up" popup (like qari's dictionary lookup): shows the
 * word's meaning, with a dictionary picker that re-queries as the user
 * changes it. `entry` is `undefined` while a lookup is in flight and `null`
 * once it has come back with nothing.
 */
export function DictionaryDialog({ opened, word, language, stores, onClose }: DictionaryDialogProps) {
  const strings = useUiStrings();
  const portalTarget = usePortalTarget();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [entry, setEntry] = useState<DictionaryEntry | null | undefined>(undefined);

  useEffect(() => {
    if (!opened) return;
    const store = stores.find((s) => s.id === storeId) ?? stores[0];
    if (!store) {
      setEntry(null);
      return;
    }
    let active = true;
    setEntry(undefined);
    store
      .lookup(word, language)
      .then((result) => {
        if (active) setEntry(result);
      })
      .catch(() => {
        if (active) setEntry(null);
      });
    return () => {
      active = false;
    };
  }, [opened, word, language, storeId, stores]);

  return (
    <Modal opened={opened} onClose={onClose} title={strings.dictionaryLookup.title} centered size="sm" portalProps={{ target: portalTarget }}>
      <div className="likhari-dictionary-word">{word}</div>
      {stores.length > 1 && (
        <Select
          mt="sm"
          label={strings.dictionaryLookup.dictionaryLabel}
          value={stores.some((s) => s.id === storeId) ? storeId : stores[0]?.id ?? null}
          data={stores.map((s) => ({ value: s.id, label: s.label }))}
          onChange={(value) => setStoreId(value ?? stores[0]?.id ?? '')}
          allowDeselect={false}
        />
      )}
      <div className="likhari-dictionary-meaning" aria-live="polite">
        {entry === undefined && <span className="likhari-dictionary-status">{strings.dictionaryLookup.loading}</span>}
        {entry === null && <span className="likhari-dictionary-status">{strings.dictionaryLookup.none}</span>}
        {entry && (
          <ul>
            {entry.meanings.map((meaning, index) => (
              <li key={index}>{meaning}</li>
            ))}
          </ul>
        )}
      </div>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {strings.dictionaryLookup.close}
        </Button>
      </Group>
    </Modal>
  );
}
