import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, FileInput, Group, Modal, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { IconPhotoDown } from '@tabler/icons-react';
import { ACCEPTED_IMAGE_TYPES, normalizeImageUrl, validateImageFile } from './imageUrl';
import { dataUrlBytes, dataUrlToFile, fetchImageAsDataUrl, mimeFromSrc } from './imageEdit';
import { useImageOptions } from './ImageOptionsContext';
import type { ImageLinkType } from './ImageNode';

export interface ImageDialogValue {
  src: string;
  altText: string;
  /** null = no caption */
  caption: string | null;
  linkType: ImageLinkType;
  /** Whether the pixels changed (a new URL/upload, or a conversion) — the
   * display size no longer matches, so the caller should reset it to auto. */
  sourceChanged: boolean;
}

export interface ImageDialogProps {
  /** `insert`: pick an image. `edit`: also change its source, alt text and caption. */
  mode: 'insert' | 'edit';
  opened: boolean;
  /** The image being edited (edit mode). */
  initial?: { src: string; altText: string; caption: string | null; linkType: ImageLinkType };
  /** What to do as the dialog opens: focus the caption field, or start converting
   * a linked image to an embedded one. */
  intent?: 'caption' | 'convert';
  onSubmit: (image: ImageDialogValue) => void;
  onClose: () => void;
}

type Source = 'keep' | ImageLinkType;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Insert-image dialog (UI spec §6) and, in edit mode, the image's details:
 * replace the source (URL or upload), alt text, caption, and — for a linked
 * image — convert it to an embedded one. Cropping, rotating and resizing an
 * embedded image is a separate dialog (`ImageCropDialog`), reached from the
 * image's context menu once it has pixels of its own to edit.
 */
export function ImageDialog({ mode, opened, initial, intent, onSubmit, onClose }: ImageDialogProps) {
  const { allowLinked, allowEmbedded, allowCaption, maxSizeMB, onImageUpload, fetchImage } = useImageOptions();
  const editing = mode === 'edit' && initial !== undefined;
  const defaultSource: Source = editing ? 'keep' : allowLinked ? 'linked' : 'embedded';

  const [source, setSource] = useState<Source>(defaultSource);
  const [url, setUrl] = useState('');
  const [embedCopy, setEmbedCopy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setSource(defaultSource);
    setUrl('');
    setEmbedCopy(false);
    setFile(null);
    setFileSrc(null);
    setAltText(initial?.altText ?? '');
    setCaption(initial?.caption ?? '');
    setError(null);
    setBusy(false);
    setConverting(false);
    if (intent === 'convert' && initial?.linkType === 'linked') void convert(initial.src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const baseSrc = source === 'keep' ? (initial?.src ?? null) : source === 'linked' ? normalizeImageUrl(url) : fileSrc;
  const effectiveLinkType: ImageLinkType = source === 'keep' ? (initial?.linkType ?? 'linked') : source === 'linked' ? 'linked' : 'embedded';
  const convertedFromUrl = source === 'embedded' && fileSrc !== null && file === null;

  const changeSource = (next: Source) => {
    setSource(next);
    setFile(null);
    setFileSrc(null);
    setError(null);
  };

  const changeFile = async (next: File | null) => {
    setFile(next);
    setFileSrc(null);
    setError(null);
    if (!next) return;
    const problem = validateImageFile(next, maxSizeMB);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      setFileSrc(await readAsDataUrl(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file');
    }
  };

  /** Downloads a linked image and switches the dialog to its embedded copy. */
  const convert = async (src: string | null) => {
    if (!src) return;
    setConverting(true);
    setError(null);
    try {
      const dataUrl = await fetchImageAsDataUrl(src, fetchImage);
      if (dataUrlBytes(dataUrl) > maxSizeMB * 1024 * 1024) throw new Error(`Image is larger than ${maxSizeMB} MB`);
      setSource('embedded');
      setFile(null);
      setFileSrc(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert the image');
    } finally {
      setConverting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!baseSrc) {
      setError(source === 'linked' ? 'Enter an http(s) or relative image URL' : source === 'embedded' ? 'Choose an image file' : 'No image');
      return;
    }

    try {
      let src = baseSrc;
      let linkType: ImageLinkType = effectiveLinkType;

      // Pixels the document doesn't reference yet (an upload, or a downloaded
      // copy of a linked image) are stored: through the host's handler, or
      // embedded as a data URI.
      let newPixels = source === 'embedded' ? fileSrc : null;
      if (!newPixels && source === 'linked' && embedCopy) {
        setBusy(true);
        newPixels = await fetchImageAsDataUrl(baseSrc, fetchImage);
      }
      if (newPixels) {
        if (dataUrlBytes(newPixels) > maxSizeMB * 1024 * 1024) {
          setError(`Image is larger than ${maxSizeMB} MB`);
          return;
        }
        linkType = 'embedded';
        if (onImageUpload) {
          setBusy(true);
          const ext = mimeFromSrc(newPixels).split('/')[1];
          const upload = !file ? dataUrlToFile(newPixels, `image.${ext}`) : file;
          src = await onImageUpload(upload);
          if (!normalizeImageUrl(src)) {
            setError('The upload handler returned an unusable image URL');
            return;
          }
        } else {
          src = newPixels;
        }
      }

      onSubmit({
        src,
        altText: altText.trim(),
        caption: allowCaption ? caption.trim() || null : (initial?.caption ?? null),
        linkType,
        sourceChanged: source !== 'keep',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the image');
    } finally {
      setBusy(false);
    }
  };

  const convertButton = (
    <Button
      size="xs"
      variant="light"
      leftSection={<IconPhotoDown size={14} />}
      loading={converting}
      disabled={!baseSrc}
      onClick={() => convert(baseSrc)}
    >
      Convert to embedded image
    </Button>
  );

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit image' : 'Insert image'} centered size="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {(editing || (allowLinked && allowEmbedded)) && (
            <SegmentedControl
              fullWidth
              value={source}
              onChange={(v) => changeSource(v as Source)}
              data={[
                ...(editing ? [{ value: 'keep', label: 'Current image' }] : []),
                ...(allowLinked ? [{ value: 'linked', label: 'From URL' }] : []),
                ...(allowEmbedded ? [{ value: 'embedded', label: 'Upload' }] : []),
              ]}
            />
          )}
          {source === 'keep' && (
            <Stack gap={6}>
              <Text size="sm" c="dimmed" lineClamp={2} style={{ wordBreak: 'break-all' }}>
                {initial?.linkType === 'embedded' ? 'Embedded in the document' : `Linked from ${initial?.src}`}
              </Text>
              {initial?.linkType === 'linked' && allowEmbedded && (
                <Group gap="xs">
                  {convertButton}
                  <Text size="xs" c="dimmed">
                    Downloads a copy into the document, so it can be cropped, rotated and resized.
                  </Text>
                </Group>
              )}
            </Stack>
          )}
          {source === 'linked' && (
            <>
              <TextInput
                label="Image URL"
                placeholder="https://example.com/photo.jpg"
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                data-autofocus={intent !== 'caption' ? true : undefined}
              />
              {allowEmbedded && (
                <Checkbox
                  label="Embed a copy in the document"
                  description="Downloads the image so it can be edited and no longer depends on the URL."
                  checked={embedCopy}
                  onChange={(e) => setEmbedCopy(e.currentTarget.checked)}
                />
              )}
            </>
          )}
          {source === 'embedded' &&
            (convertedFromUrl ? (
              <Text size="sm" c="dimmed">
                Converted from the URL: a copy will be embedded in the document.
              </Text>
            ) : (
              <FileInput
                label="Image file"
                placeholder="Choose an image"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                value={file}
                onChange={changeFile}
                description={`Up to ${maxSizeMB} MB${onImageUpload ? '' : '; stored inside the document'}`}
              />
            ))}
          <TextInput
            label="Alt text"
            description="Describes the image for screen readers"
            value={altText}
            onChange={(e) => setAltText(e.currentTarget.value)}
          />
          {allowCaption && (
            <TextInput
              label="Caption"
              description="Shown under the image. Leave empty for none."
              value={caption}
              onChange={(e) => setCaption(e.currentTarget.value)}
              data-autofocus={intent === 'caption' ? true : undefined}
            />
          )}
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
              {editing ? 'Save' : 'Insert'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
