import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ActionIcon, Alert, Button, Group, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconCrop,
  IconFlipHorizontal,
  IconFlipVertical,
  IconRestore,
  IconRotate2,
  IconRotateClockwise2,
} from '@tabler/icons-react';
import { applyPixelOp, type CropRect, type PixelOp } from './imageEdit';

const ASPECTS: Record<string, number | null> = { free: null, '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 };

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);

export interface ImageCropperProps {
  /** The image as it is now (original, or already edited). */
  src: string;
  /** Called with the edited image as a data URI. */
  onApply: (edited: string) => void;
  /** Whether there are edits to undo. */
  canReset: boolean;
  onReset: () => void;
}

/** Rotate, flip and crop. Drag on the preview to choose the area to keep, then
 * "Apply crop"; each operation re-renders the pixels, so it needs an image the
 * canvas may read (uploaded files and same-origin/CORS-enabled URLs). */
export function ImageCropper({ src, onApply, canReset, onReset }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [aspect, setAspect] = useState('free');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (op: PixelOp) => {
    setBusy(true);
    setError(null);
    try {
      onApply(await applyPixelOp(src, op));
      setRect(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not edit the image');
    } finally {
      setBusy(false);
    }
  };

  const pointerFraction = (event: ReactPointerEvent) => {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height), box };
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointerFraction(event);
    if (!p) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: p.x, y: p.y };
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    const p = pointerFraction(event);
    if (!start || !p) return;
    let dx = p.x - start.x;
    let dy = p.y - start.y;
    const ratio = ASPECTS[aspect];
    if (ratio) {
      // Keep the chosen aspect ratio in pixels, shrinking to fit inside the image.
      let widthPx = Math.abs(dx) * p.box.width;
      let heightPx = widthPx / ratio;
      const maxHeightPx = (dy >= 0 ? 1 - start.y : start.y) * p.box.height;
      if (heightPx > maxHeightPx) {
        heightPx = maxHeightPx;
        widthPx = heightPx * ratio;
      }
      dx = (dx >= 0 ? 1 : -1) * (widthPx / p.box.width);
      dy = (dy >= 0 ? 1 : -1) * (heightPx / p.box.height);
    }
    setRect({ x: Math.min(start.x, start.x + dx), y: Math.min(start.y, start.y + dy), w: Math.abs(dx), h: Math.abs(dy) });
  };

  const onUp = () => {
    dragStart.current = null;
    // A click without a drag isn't a selection.
    setRect((r) => (r && (r.w < 0.02 || r.h < 0.02) ? null : r));
  };

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Tooltip label="Rotate left">
          <ActionIcon variant="default" aria-label="Rotate left" disabled={busy} onClick={() => run({ type: 'rotate', direction: 'ccw' })}>
            <IconRotate2 size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Rotate right">
          <ActionIcon variant="default" aria-label="Rotate right" disabled={busy} onClick={() => run({ type: 'rotate', direction: 'cw' })}>
            <IconRotateClockwise2 size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Flip horizontally">
          <ActionIcon variant="default" aria-label="Flip horizontally" disabled={busy} onClick={() => run({ type: 'flip', axis: 'horizontal' })}>
            <IconFlipHorizontal size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Flip vertically">
          <ActionIcon variant="default" aria-label="Flip vertically" disabled={busy} onClick={() => run({ type: 'flip', axis: 'vertical' })}>
            <IconFlipVertical size={16} />
          </ActionIcon>
        </Tooltip>
        <Button
          ml="auto"
          size="xs"
          variant="subtle"
          leftSection={<IconRestore size={14} />}
          disabled={!canReset || busy}
          onClick={() => {
            setRect(null);
            setError(null);
            onReset();
          }}
        >
          Undo edits
        </Button>
      </Group>

      <Group gap="xs" align="center">
        <Text size="sm">Crop shape</Text>
        <SegmentedControl
          size="xs"
          value={aspect}
          onChange={(v) => {
            setAspect(v);
            setRect(null);
          }}
          data={[
            { value: 'free', label: 'Free' },
            { value: '1:1', label: '1:1' },
            { value: '4:3', label: '4:3' },
            { value: '16:9', label: '16:9' },
          ]}
        />
      </Group>

      <div
        className="likhari-cropper-stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img ref={imgRef} src={src} alt="" draggable={false} className="likhari-cropper-image" />
        {rect && rect.w > 0 && rect.h > 0 && (
          <div
            className="likhari-cropper-selection"
            style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
          />
        )}
      </div>

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Drag on the image to choose the area to keep.
        </Text>
        <Button
          size="xs"
          leftSection={<IconCrop size={14} />}
          disabled={!rect || busy}
          loading={busy}
          onClick={() => rect && run({ type: 'crop', rect })}
        >
          Apply crop
        </Button>
      </Group>

      {error && (
        <Alert color="red" variant="light" p="xs">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
