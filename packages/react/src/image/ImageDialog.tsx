import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, FileInput, Group, Modal, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { IconPhotoDown } from '@tabler/icons-react';
import { ACCEPTED_IMAGE_TYPES, normalizeImageUrl, validateImageFile } from './imageUrl';
import { dataUrlBytes, dataUrlToFile, fetchImageAsDataUrl, mimeFromSrc } from './imageEdit';
import { useImageOptions } from './ImageOptionsContext';
import { useUiStrings } from '../i18n/useStrings';
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
    reader.onerror = () => reject(new Error('READ_FAILED'));
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
  const strings = useUiStrings();
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
    } catch {
      setError(strings.imageDialog.errors.couldNotReadFile);
    }
  };

  /** Downloads a linked image and switches the dialog to its embedded copy. */
  const convert = async (src: string | null) => {
    if (!src) return;
    setConverting(true);
    setError(null);
    try {
      const dataUrl = await fetchImageAsDataUrl(src, fetchImage);
      if (dataUrlBytes(dataUrl) > maxSizeMB * 1024 * 1024) throw new Error(strings.imageDialog.errors.largerThan(maxSizeMB));
      setSource('embedded');
      setFile(null);
      setFileSrc(dataUrl);
    } catch (err) {
      // fetchImageAsDataUrl's own errors (network/CORS failures, unsupported
      // type) are English (packages/react/src/image/imageEdit.ts) — shown
      // as-is since threading locale into that pure utility isn't worth the
      // refactor here; only the size-limit message above is ours to localize.
      setError(err instanceof Error ? err.message : strings.imageDialog.errors.couldNotConvert);
    } finally {
      setConverting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!baseSrc) {
      setError(
        source === 'linked'
          ? strings.imageDialog.errors.enterUrl
          : source === 'embedded'
            ? strings.imageDialog.errors.chooseFile
            : strings.imageDialog.errors.noImage,
      );
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
          setError(strings.imageDialog.errors.largerThan(maxSizeMB));
          return;
        }
        linkType = 'embedded';
        if (onImageUpload) {
          setBusy(true);
          const ext = mimeFromSrc(newPixels).split('/')[1];
          const upload = !file ? dataUrlToFile(newPixels, `image.${ext}`) : file;
          src = await onImageUpload(upload);
          if (!normalizeImageUrl(src)) {
            setError(strings.imageDialog.errors.uploadUnusable);
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
      // fetchImageAsDataUrl's own network/CORS error message (imageEdit.ts)
      // is shown as-is when present — see note in `convert` above.
      setError(err instanceof Error ? err.message : strings.imageDialog.errors.couldNotSave);
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
      {strings.imageDialog.convertButton}
    </Button>
  );

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? strings.imageDialog.titleEdit : strings.imageDialog.titleInsert} centered size="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {(editing || (allowLinked && allowEmbedded)) && (
            <SegmentedControl
              fullWidth
              value={source}
              onChange={(v) => changeSource(v as Source)}
              data={[
                ...(editing ? [{ value: 'keep', label: strings.imageDialog.currentImage }] : []),
                ...(allowLinked ? [{ value: 'linked', label: strings.imageDialog.fromUrl }] : []),
                ...(allowEmbedded ? [{ value: 'embedded', label: strings.imageDialog.upload }] : []),
              ]}
            />
          )}
          {source === 'keep' && (
            <Stack gap={6}>
              <Text size="sm" c="dimmed" lineClamp={2} style={{ wordBreak: 'break-all' }}>
                {initial?.linkType === 'embedded' ? strings.imageDialog.embeddedInDocument : strings.imageDialog.linkedFrom(initial?.src ?? '')}
              </Text>
              {initial?.linkType === 'linked' && allowEmbedded && (
                <Group gap="xs">
                  {convertButton}
                  <Text size="xs" c="dimmed">
                    {strings.imageDialog.convertHint}
                  </Text>
                </Group>
              )}
            </Stack>
          )}
          {source === 'linked' && (
            <>
              <TextInput
                label={strings.imageDialog.imageUrlLabel}
                placeholder={strings.imageDialog.imageUrlPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                data-autofocus={intent !== 'caption' ? true : undefined}
              />
              {allowEmbedded && (
                <Checkbox
                  label={strings.imageDialog.embedCopyLabel}
                  description={strings.imageDialog.embedCopyDescription}
                  checked={embedCopy}
                  onChange={(e) => setEmbedCopy(e.currentTarget.checked)}
                />
              )}
            </>
          )}
          {source === 'embedded' &&
            (convertedFromUrl ? (
              <Text size="sm" c="dimmed">
                {strings.imageDialog.convertedFromUrl}
              </Text>
            ) : (
              <FileInput
                label={strings.imageDialog.fileLabel}
                placeholder={strings.imageDialog.filePlaceholder}
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                value={file}
                onChange={changeFile}
                description={strings.imageDialog.fileDescription(maxSizeMB, !onImageUpload)}
              />
            ))}
          <TextInput
            label={strings.imageDialog.altTextLabel}
            description={strings.imageDialog.altTextDescription}
            value={altText}
            onChange={(e) => setAltText(e.currentTarget.value)}
          />
          {allowCaption && (
            <TextInput
              label={strings.imageDialog.captionLabel}
              description={strings.imageDialog.captionDescription}
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
              {strings.common.cancel}
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? strings.common.save : strings.common.insert}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
