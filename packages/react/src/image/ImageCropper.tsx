import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCrop,
  IconFlipHorizontal,
  IconFlipVertical,
  IconRestore,
  IconRotate2,
  IconRotateClockwise2,
} from "@tabler/icons-react";
import { applyPixelOp, type CropRect, type PixelOp } from "./imageEdit";
import {
  MIN_CROP,
  moveRect,
  rectFromDrag,
  resizeRect,
  type CropHandle,
} from "./cropMath";
import { usePortalTarget } from "../PortalTargetContext";

const ASPECTS: Record<string, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
};
const HANDLES: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);

type Drag =
  | { mode: "new"; anchor: { x: number; y: number } }
  | { mode: "move"; start: { x: number; y: number }; origin: CropRect }
  | { mode: "resize"; handle: CropHandle; origin: CropRect };

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
 * drag its handles to resize it or drag inside it to move it, then "Apply crop".
 * Each operation re-renders the pixels, so it needs an image the canvas may read
 * (an embedded image). */
export function ImageCropper({
  src,
  onApply,
  canReset,
  onReset,
}: ImageCropperProps) {
  const portalTarget = usePortalTarget();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [aspect, setAspect] = useState("free");
  const [natural, setNatural] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (op: PixelOp) => {
    setBusy(true);
    setError(null);
    try {
      onApply(await applyPixelOp(src, op));
      setRect(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit the image");
    } finally {
      setBusy(false);
    }
  };

  const pointer = (event: ReactPointerEvent) => {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return {
      point: {
        x: clamp((event.clientX - box.left) / box.width),
        y: clamp((event.clientY - box.top) / box.height),
      },
      box: { width: box.width, height: box.height },
    };
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointer(event);
    if (!p) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = event.target as HTMLElement;
    const handle = target.dataset.handle as CropHandle | undefined;
    if (handle && rect) {
      drag.current = { mode: "resize", handle, origin: rect };
    } else if (target.dataset.move && rect) {
      drag.current = { mode: "move", start: p.point, origin: rect };
    } else {
      drag.current = { mode: "new", anchor: p.point };
      setRect({ x: p.point.x, y: p.point.y, w: 0, h: 0 });
    }
  };

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    const p = pointer(event);
    if (!current || !p) return;
    const ratio = ASPECTS[aspect];
    if (current.mode === "new")
      setRect(rectFromDrag(current.anchor, p.point, ratio, p.box));
    else if (current.mode === "move")
      setRect(
        moveRect(
          current.origin,
          p.point.x - current.start.x,
          p.point.y - current.start.y,
        ),
      );
    else
      setRect(
        resizeRect(current.origin, current.handle, p.point, ratio, p.box),
      );
  };

  const onUp = () => {
    const wasNew = drag.current?.mode === "new";
    drag.current = null;
    // A click without a drag isn't a selection.
    if (wasNew)
      setRect((r) => (r && (r.w < MIN_CROP || r.h < MIN_CROP) ? null : r));
  };

  const selectionSize =
    rect && natural && rect.w > 0 && rect.h > 0
      ? `${Math.max(1, Math.round(rect.w * natural.width))} × ${Math.max(1, Math.round(rect.h * natural.height))} px`
      : null;

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Tooltip label="Rotate left" portalProps={{ target: portalTarget }}>
          <ActionIcon
            variant="default"
            aria-label="Rotate left"
            disabled={busy}
            onClick={() => run({ type: "rotate", direction: "ccw" })}
          >
            <IconRotate2 size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Rotate right" portalProps={{ target: portalTarget }}>
          <ActionIcon
            variant="default"
            aria-label="Rotate right"
            disabled={busy}
            onClick={() => run({ type: "rotate", direction: "cw" })}
          >
            <IconRotateClockwise2 size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Flip horizontally" portalProps={{ target: portalTarget }}>
          <ActionIcon
            variant="default"
            aria-label="Flip horizontally"
            disabled={busy}
            onClick={() => run({ type: "flip", axis: "horizontal" })}
          >
            <IconFlipHorizontal size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Flip vertically" portalProps={{ target: portalTarget }}>
          <ActionIcon
            variant="default"
            aria-label="Flip vertically"
            disabled={busy}
            onClick={() => run({ type: "flip", axis: "vertical" })}
          >
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
            { value: "free", label: "Free" },
            { value: "1:1", label: "1:1" },
            { value: "4:3", label: "4:3" },
            { value: "16:9", label: "16:9" },
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
        <div className="likhari-cropper-frame">
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            className="likhari-cropper-image"
            onLoad={(e) =>
              setNatural({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
          />
          {rect && rect.w > 0 && rect.h > 0 && (
            <div
              className="likhari-cropper-selection"
              data-move="true"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
              }}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle}
                  className="likhari-cropper-handle"
                  data-handle={handle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {selectionSize
            ? `Selection: ${selectionSize}. Drag the handles to resize it, or drag inside to move it.`
            : "Drag on the image to choose the area to keep."}
        </Text>
        <Button
          size="xs"
          leftSection={<IconCrop size={14} />}
          disabled={!rect || busy}
          loading={busy}
          onClick={() => rect && run({ type: "crop", rect })}
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
