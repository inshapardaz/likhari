import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Checkbox, Divider, Group, Modal, NumberInput, Stack, Text } from '@mantine/core';
import { normalizeImageUrl } from './imageUrl';
import { dataUrlBytes, dataUrlToFile, fitDimension, mimeFromSrc } from './imageEdit';
import { ImageCropper } from './ImageCropper';
import { useImageOptions } from './ImageOptionsContext';

export interface ImageCropDialogValue {
  src: string;
  width: number | null;
  height: number | null;
}

export interface ImageCropDialogProps {
  opened: boolean;
  /** The embedded image being edited — only images with pixels of their own
   * (not linked ones) can be cropped, rotated or resized here. */
  initial: { src: string; width: number | null; height: number | null };
  onSubmit: (value: ImageCropDialogValue) => void;
  onClose: () => void;
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

/** Crop, rotate, flip and resize dialog for an embedded image, reached from
 * its context menu. Edits that change pixels are re-embedded as a data URI,
 * or stored through the host's `onImageUpload` when there is one. */
export function ImageCropDialog({ opened, initial, onSubmit, onClose }: ImageCropDialogProps) {
  const { maxSizeMB, onImageUpload } = useImageOptions();

  const [pixelSrc, setPixelSrc] = useState<string | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [lockAspect, setLockAspect] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setPixelSrc(null);
    setWidth(initial.width);
    setHeight(initial.height);
    setLockAspect(true);
    setError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const effectiveSrc = pixelSrc ?? initial.src;
  const natural = useNaturalSize(effectiveSrc);

  const resetSize = () => {
    setWidth(null);
    setHeight(null);
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
    try {
      let src = effectiveSrc;
      if (pixelSrc) {
        if (dataUrlBytes(pixelSrc) > maxSizeMB * 1024 * 1024) {
          setError(`Image is larger than ${maxSizeMB} MB`);
          return;
        }
        if (onImageUpload) {
          setBusy(true);
          const ext = mimeFromSrc(pixelSrc).split('/')[1];
          src = await onImageUpload(dataUrlToFile(pixelSrc, `image.${ext}`));
          if (!normalizeImageUrl(src)) {
            setError('The upload handler returned an unusable image URL');
            return;
          }
        }
      }
      onSubmit({ src, width, height });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Crop & resize" centered size="lg">
      <form onSubmit={handleSubmit}>
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
              setWidth(initial.width);
              setHeight(initial.height);
            }}
          />
          <Divider label="Size" labelPosition="left" />
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
              <Button size="xs" variant="subtle" onClick={resetSize}>
                Original size
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              You can also drag the corner handle on a selected image. {natural ? `Original: ${natural.width} × ${natural.height} px.` : ''}
            </Text>
          </Stack>
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
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
