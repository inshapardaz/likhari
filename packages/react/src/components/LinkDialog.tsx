import { useEffect, useState, type FormEvent } from 'react';
import { Button, Group, Modal, TextInput } from '@mantine/core';
import { normalizeLinkUrl } from '../utils/linkUrl';

export interface LinkDialogProps {
  opened: boolean;
  /** Existing link's URL when editing; empty when inserting. */
  initialUrl: string;
  /** Show a "Text" field — used when nothing is selected, so there is no text to link. */
  showTextField: boolean;
  onSubmit: (link: { url: string; text: string }) => void;
  /** Present only when editing an existing link. */
  onRemove?: () => void;
  onClose: () => void;
}

/** Insert/edit-link dialog (UI spec §6). Mantine Modal supplies focus
 * trapping, Escape-to-close and the overlay. */
export function LinkDialog({ opened, initialUrl, showTextField, onSubmit, onRemove, onClose }: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setUrl(initialUrl);
      setText('');
      setError(null);
    }
  }, [opened, initialUrl]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeLinkUrl(url);
    if (!normalized) {
      setError('Enter a valid http(s), mailto, tel or relative URL');
      return;
    }
    onSubmit({ url: normalized, text: text.trim() || normalized });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={onRemove ? 'Edit link' : 'Insert link'} centered size="sm">
      <form onSubmit={handleSubmit}>
        <TextInput
          label="URL"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => {
            setUrl(e.currentTarget.value);
            setError(null);
          }}
          error={error}
          data-autofocus
        />
        {showTextField && (
          <TextInput
            mt="sm"
            label="Text"
            placeholder="Link text (defaults to the URL)"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
        )}
        <Group justify="space-between" mt="md">
          {onRemove ? (
            <Button variant="subtle" color="red" onClick={onRemove}>
              Remove link
            </Button>
          ) : (
            <span />
          )}
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Apply</Button>
          </Group>
        </Group>
      </form>
    </Modal>
  );
}
