import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, FileInput, Group, Modal, SegmentedControl, Stack, TextInput } from '@mantine/core';
import { ACCEPTED_IMAGE_TYPES, normalizeImageUrl, validateImageFile } from './imageUrl';
import type { ImageLinkType } from './ImageNode';

export interface ImageDialogResult {
  src: string;
  altText: string;
  caption: string | null;
  linkType: ImageLinkType;
}

export interface ImageDialogProps {
  opened: boolean;
  /** `images.linked` — allow an external URL. */
  allowLinked: boolean;
  /** `images.embedded` — allow uploading a file. */
  allowEmbedded: boolean;
  /** `images.caption` — image gets an (initially empty) caption. */
  allowCaption: boolean;
  /** `images.maxSizeMB` */
  maxSizeMB: number;
  /** Host upload handler; when absent, uploads are embedded as base64 data URIs. */
  onImageUpload?: (file: File) => Promise<string>;
  onSubmit: (image: ImageDialogResult) => void;
  onClose: () => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/** Insert-image dialog (UI spec §6): an external URL and/or an uploaded file. */
export function ImageDialog({
  opened,
  allowLinked,
  allowEmbedded,
  allowCaption,
  maxSizeMB,
  onImageUpload,
  onSubmit,
  onClose,
}: ImageDialogProps) {
  const defaultSource: ImageLinkType = allowLinked ? 'linked' : 'embedded';
  const [source, setSource] = useState<ImageLinkType>(defaultSource);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) {
      setSource(defaultSource);
      setUrl('');
      setFile(null);
      setAltText('');
      setError(null);
      setBusy(false);
    }
  }, [opened, defaultSource]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      let src: string | null;
      if (source === 'linked') {
        src = normalizeImageUrl(url);
        if (!src) {
          setError('Enter an http(s) or relative image URL');
          return;
        }
      } else {
        if (!file) {
          setError('Choose an image file');
          return;
        }
        const problem = validateImageFile(file, maxSizeMB);
        if (problem) {
          setError(problem);
          return;
        }
        setBusy(true);
        src = onImageUpload ? await onImageUpload(file) : await readAsDataUrl(file);
        if (!normalizeImageUrl(src)) {
          setError('The upload handler returned an unusable image URL');
          setBusy(false);
          return;
        }
      }
      onSubmit({ src, altText: altText.trim(), caption: allowCaption ? '' : null, linkType: source });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the image');
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Insert image" centered size="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {allowLinked && allowEmbedded && (
            <SegmentedControl
              fullWidth
              value={source}
              onChange={(v) => {
                setSource(v as ImageLinkType);
                setError(null);
              }}
              data={[
                { value: 'linked', label: 'From URL' },
                { value: 'embedded', label: 'Upload' },
              ]}
            />
          )}
          {source === 'linked' ? (
            <TextInput
              label="Image URL"
              placeholder="https://example.com/photo.jpg"
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
              data-autofocus
            />
          ) : (
            <FileInput
              label="Image file"
              placeholder="Choose an image"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              value={file}
              onChange={setFile}
              description={`Up to ${maxSizeMB} MB${onImageUpload ? '' : '; stored inside the document'}`}
            />
          )}
          <TextInput
            label="Alt text"
            description="Describes the image for screen readers"
            value={altText}
            onChange={(e) => setAltText(e.currentTarget.value)}
          />
          {error && (
            <Alert color="red" variant="light" p="xs">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Insert
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
