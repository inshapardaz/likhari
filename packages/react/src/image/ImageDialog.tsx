import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPhotoDown } from '@tabler/icons-react';
import { ACCEPTED_IMAGE_TYPES, normalizeImageUrl, validateImageFile } from './imageUrl';
import { dataUrlBytes, dataUrlToFile, fetchImageAsDataUrl, fitDimension, mimeFromSrc } from './imageEdit';
import { ImageCropper } from './ImageCropper';
import { useImageOptions } from './ImageOptionsContext';
import type { ImageLinkType } from './ImageNode';

export interface ImageDialogValue {
  src: string;
  altText: string;
  /** null = no caption */
  caption: string | null;
  linkType: ImageLinkType;
  /** Display size in px; null = natural size */
  width: number | null;
  height: number | null;
}

export interface ImageDialogProps {
  /** `insert`: pick an image. `edit`: also change its source, and — for embedded
   * images only — size, crop and rotation. */
  mode: 'insert' | 'edit';
  opened: boolean;
  /** The image being edited (edit mode). */
  initial?: ImageDialogValue;
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

/** Natural pixel size of an image URL (for the aspect ratio and size presets). */
function useNaturalSize(src: string | null) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth) setSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return size;
}

/**
 * Insert-image dialog (UI spec §6) and, in edit mode, the image editor.
 *
 * - *Details*: replace the image (URL or upload), alt text, caption, and — for a
 *   linked image — convert it to an embedded one.
 * - *Crop & size* (embedded images only): rotate, flip, crop with draggable
 *   handles, and set the display size.
 *
 * Linked images are never pixel-edited: there is no copy of the pixels in the
 * document to change. Converting one downloads it and embeds the copy. Edits
 * that change pixels are embedded as a data URI, or stored through the host's
 * `onImageUpload` when there is one.
 */
export function ImageDialog({ mode, opened, initial, intent, onSubmit, onClose }: ImageDialogProps) {
  const { allowLinked, allowEmbedded, allowCaption, maxSizeMB, onImageUpload } = useImageOptions();
  const editing = mode === 'edit' && initial !== undefined;
  const defaultSource: Source = editing ? 'keep' : allowLinked ? 'linked' : 'embedded';

  const [tab, setTab] = useState('details');
  const [source, setSource] = useState<Source>(defaultSource);
  const [url, setUrl] = useState('');
  const [embedCopy, setEmbedCopy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [lockAspect, setLockAspect] = useState(true);
  const [pixelSrc, setPixelSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setTab('details');
    setSource(defaultSource);
    setUrl('');
    setEmbedCopy(false);
    setFile(null);
    setFileSrc(null);
    setAltText(initial?.altText ?? '');
    setCaption(initial?.caption ?? '');
    setWidth(initial?.width ?? null);
    setHeight(initial?.height ?? null);
    setLockAspect(true);
    setPixelSrc(null);
    setError(null);
    setBusy(false);
    setConverting(false);
    if (intent === 'convert' && initial?.linkType === 'linked') void convert(initial.src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // The image before any crop/rotate: the current one, the typed URL, or the chosen file.
  const baseSrc = source === 'keep' ? (initial?.src ?? null) : source === 'linked' ? normalizeImageUrl(url) : fileSrc;
  const effectiveSrc = pixelSrc ?? baseSrc;
  const natural = useNaturalSize(effectiveSrc);

  // Only embedded images have pixels of their own to crop, rotate and resize.
  const effectiveLinkType: ImageLinkType = source === 'keep' ? (initial?.linkType ?? 'linked') : source === 'linked' ? 'linked' : 'embedded';
  const canEditPixels = effectiveLinkType === 'embedded' && effectiveSrc !== null;
  const convertedFromUrl = source === 'embedded' && fileSrc !== null && file === null;

  /** A new source or new pixels invalidate any custom size. */
  const resetSize = (toInitial = false) => {
    setWidth(toInitial ? (initial?.width ?? null) : null);
    setHeight(toInitial ? (initial?.height ?? null) : null);
  };

  const changeSource = (next: Source) => {
    setSource(next);
    setPixelSrc(null);
    setFile(null);
    setFileSrc(null);
    resetSize(next === 'keep');
    setError(null);
  };

  const changeFile = async (next: File | null) => {
    setFile(next);
    setFileSrc(null);
    setPixelSrc(null);
    resetSize();
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
      const dataUrl = await fetchImageAsDataUrl(src);
      if (dataUrlBytes(dataUrl) > maxSizeMB * 1024 * 1024) throw new Error(`Image is larger than ${maxSizeMB} MB`);
      setSource('embedded');
      setFile(null);
      setFileSrc(dataUrl);
      setPixelSrc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not convert the image');
    } finally {
      setConverting(false);
    }
  };

  const onSizeChange = (changed: 'width' | 'height', value: number | string) => {
    const n = typeof value === 'number' ? value : null;
    if (n === null) {
      changed === 'width' ? setWidth(null) : setHeight(null);
      return;
    }
    if (lockAspect && natural) {
      const fitted = fitDimension(changed, n, natural.width, natural.height);
      setWidth(fitted.width);
      setHeight(fitted.height);
    } else {
      changed === 'width' ? setWidth(n) : setHeight(n);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!effectiveSrc) {
      setError(source === 'linked' ? 'Enter an http(s) or relative image URL' : source === 'embedded' ? 'Choose an image file' : 'No image');
      return;
    }

    try {
      let src = effectiveSrc;
      let linkType: ImageLinkType = effectiveLinkType;

      // Pixels the document doesn't reference yet (an upload, an edit, or a
      // downloaded copy of a linked image) are stored: through the host's
      // handler, or embedded as a data URI.
      let newPixels = pixelSrc ?? (source === 'embedded' ? fileSrc : null);
      if (!newPixels && source === 'linked' && embedCopy) {
        setBusy(true);
        newPixels = await fetchImageAsDataUrl(effectiveSrc);
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
          const upload = pixelSrc || !file ? dataUrlToFile(newPixels, `image.${ext}`) : file;
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
        width,
        height,
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

  const detailsPanel = (
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
            onChange={(e) => {
              setUrl(e.currentTarget.value);
              setPixelSrc(null);
              resetSize();
            }}
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
    </Stack>
  );

  const sizeSection = (
    <Stack gap="sm">
      <Group grow align="flex-end">
        <NumberInput
          label="Width (px)"
          min={1}
          max={10000}
          hideControls
          placeholder={natural ? String(natural.width) : 'Auto'}
          value={width ?? ''}
          onChange={(v) => onSizeChange('width', v)}
        />
        <NumberInput
          label="Height (px)"
          min={1}
          max={10000}
          hideControls
          placeholder={natural ? String(natural.height) : 'Auto'}
          value={height ?? ''}
          onChange={(v) => onSizeChange('height', v)}
        />
      </Group>
      <Checkbox label="Keep proportions" checked={lockAspect} onChange={(e) => setLockAspect(e.currentTarget.checked)} />
      <Group gap="xs">
        {[25, 50, 75, 100].map((pct) => (
          <Button
            key={pct}
            size="xs"
            variant="default"
            disabled={!natural}
            onClick={() => {
              if (!natural) return;
              setWidth(Math.round((natural.width * pct) / 100));
              setHeight(Math.round((natural.height * pct) / 100));
            }}
          >
            {pct}%
          </Button>
        ))}
        <Button size="xs" variant="subtle" onClick={() => resetSize()}>
          Original size
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        You can also drag the corner handle on a selected image. {natural ? `Original: ${natural.width} × ${natural.height} px.` : ''}
      </Text>
    </Stack>
  );

  const editPanel = canEditPixels ? (
    <Stack gap="md">
      <ImageCropper
        src={effectiveSrc}
        canReset={pixelSrc !== null}
        onApply={(edited) => {
          setPixelSrc(edited);
          resetSize();
        }}
        onReset={() => {
          setPixelSrc(null);
          resetSize(source === 'keep');
        }}
      />
      <Divider label="Size" labelPosition="left" />
      {sizeSection}
    </Stack>
  ) : (
    <Stack gap="sm" align="flex-start">
      <Text size="sm">
        This image is linked from a URL, so it can't be cropped, rotated or resized here. Convert it to an embedded image to edit it.
      </Text>
      {convertButton}
    </Stack>
  );

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit image' : 'Insert image'} centered size={editing ? 'lg' : 'sm'}>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {editing ? (
            <Tabs value={tab} onChange={(v) => setTab(v ?? 'details')} keepMounted={false}>
              <Tabs.List mb="sm">
                <Tabs.Tab value="details">Details</Tabs.Tab>
                <Tabs.Tab value="edit" disabled={!effectiveSrc}>
                  Crop &amp; size
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="details">{detailsPanel}</Tabs.Panel>
              <Tabs.Panel value="edit">{editPanel}</Tabs.Panel>
            </Tabs>
          ) : (
            detailsPanel
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
