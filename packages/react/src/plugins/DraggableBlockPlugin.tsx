import { useEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { eventFiles } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import { IconGripHorizontal, IconGripVertical } from '@tabler/icons-react';
import { $getNodeByKey, $getRoot, $isElementNode, $isParagraphNode, COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, DRAGOVER_COMMAND, DROP_COMMAND, type LexicalEditor } from 'lexical';
import { useUiStrings } from '../i18n/useStrings';
import { $getCouplets, $getCoupletContaining, $moveCouplet, $swapMisras, type Couplet } from '../blocks/poetryActions';
import { $isPoetryBlockNode } from '../blocks/PoetryNode';

/** Distinguishes our drags from files or text being dropped on the editor. */
const DRAG_DATA_FORMAT = 'application/x-likhari-drag';
/** Grip size and its gap from the block it belongs to. */
const GRIP_PX = 18;
const GRIP_GAP_PX = 3;
/** Set on .likhari-root while one of our drags is in flight. */
const DRAGGING_CLASS = 'likhari-dragging';

type DragKind = 'block' | 'couplet' | 'line';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** What the mouse is over: a top-level block and, inside a poetry block,
 * the couplet and the single line under it. Rects are in canvas content
 * coordinates (so they scroll with the content). */
interface Hover {
  blockKey: string;
  rect: Rect;
  rtl: boolean;
  poetry: { coupletKey: string; coupletRect: Rect; lineKey: string; lineRect: Rect } | null;
}

/** The drop indicator: a line above/below a target, or a box over the line
 * a dragged misra would swap with. */
type Indicator = { kind: 'line'; rect: Rect; edge: 'top' | 'bottom' } | { kind: 'box'; rect: Rect };

interface Drag {
  kind: DragKind;
  key: string;
}

function unionRect(rects: DOMRect[]): DOMRect {
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/** Viewport rect → position inside the (scrolling) canvas. */
function toCanvas(rect: DOMRect, canvas: HTMLElement): Rect {
  const box = canvas.getBoundingClientRect();
  return { top: rect.top - box.top + canvas.scrollTop, left: rect.left - box.left + canvas.scrollLeft, width: rect.width, height: rect.height };
}

function verticalMargins(el: HTMLElement): { top: number; bottom: number } {
  const style = getComputedStyle(el);
  return { top: parseFloat(style.marginTop) || 0, bottom: parseFloat(style.marginBottom) || 0 };
}

/** The top-level block whose vertical extent (margins included) holds `y`;
 * `nearest` falls back to the closest one for points above or below everything. */
function findTopLevelAt(editor: LexicalEditor, y: number, nearest: boolean): { key: string; el: HTMLElement } | null {
  const keys = editor.getEditorState().read(() => $getRoot().getChildrenKeys());
  let best: { key: string; el: HTMLElement; distance: number } | null = null;
  for (const key of keys) {
    const el = editor.getElementByKey(key);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const margins = verticalMargins(el);
    const top = rect.top - margins.top;
    const bottom = rect.bottom + margins.bottom;
    if (y >= top && y <= bottom) return { key, el };
    const distance = y < top ? top - y : y - bottom;
    if (nearest && (!best || distance < best.distance)) best = { key, el, distance };
  }
  return best ? { key: best.key, el: best.el } : null;
}

/** Inside a poetry block: the misra under the point (by row, then by column
 * for the two misras of a two-column couplet), falling back to the nearest
 * line vertically, with the couplet it belongs to. */
function findMisraAt(editor: LexicalEditor, blockKey: string, x: number, y: number): { couplet: Couplet; misraIndex: 0 | 1; lineEl: HTMLElement; coupletEls: HTMLElement[] } | null {
  return editor.getEditorState().read(() => {
    const block = $getNodeByKey(blockKey);
    if (!$isPoetryBlockNode(block)) return null;
    let best: { couplet: Couplet; misraIndex: 0 | 1; lineEl: HTMLElement; coupletEls: HTMLElement[]; score: number } | null = null;
    for (const couplet of $getCouplets(block)) {
      const els = couplet.map((misra) => editor.getElementByKey(misra.getKey()));
      if (!els[0] || !els[1]) continue;
      const coupletEls = els as HTMLElement[];
      coupletEls.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
        // Rows first, then columns: a point inside a row but between its two
        // misras still prefers the nearer of the two.
        const score = dy * 10_000 + dx;
        if (!best || score < best.score) best = { couplet, misraIndex: i as 0 | 1, lineEl: el, coupletEls, score };
      });
    }
    return best;
  });
}

/**
 * A drag grip beside the block under the mouse — Lexical's own
 * DraggableBlockPlugin only knows top-level blocks and only sits on the
 * left, so this is its own take with the same mechanics (an HTML5 drag from
 * the grip, DRAGOVER/DROP commands for the target), extended for poetry:
 * inside a poetry block the grip is replaced by two, one that moves the
 * couplet (within or between poetry blocks, or out between ordinary blocks
 * as a new one) and one that swaps the single line under the mouse with
 * another misra — the one line operation that never breaks a couplet. The
 * grip sits on the block's start side (right, in a right-to-left block).
 */
export function DraggableBlockPlugin() {
  const [editor] = useLexicalComposerContext();
  const strings = useUiStrings();
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<Hover | null>(null);
  hoverRef.current = hover;

  /** Ends a drag whichever way it ended: forgets it, hides the indicator and
   * gives the hover overlays their pointer events back. */
  const finishDrag = (anchor: HTMLElement) => {
    dragRef.current = null;
    setIndicator(null);
    anchor.closest('.likhari-root')?.classList.remove(DRAGGING_CLASS);
  };

  useEffect(() => {
    return editor.registerRootListener((root) => {
      setCanvas((root?.closest('.likhari-canvas') as HTMLElement | null) ?? null);
    });
  }, [editor]);

  // Hover tracking: which block (and, in poetry, which couplet and line) the grip belongs to.
  useEffect(() => {
    if (!canvas) return;
    const onMouseMove = (event: MouseEvent) => {
      if (dragRef.current || !editor.isEditable()) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.likhari-drag-grip')) return;
      const found = findTopLevelAt(editor, event.clientY, false);
      if (!found) {
        setHover(null);
        return;
      }
      const rtl = getComputedStyle(found.el).direction === 'rtl';
      const isPoetry = editor.getEditorState().read(() => $isPoetryBlockNode($getNodeByKey(found.key)));
      let poetry: Hover['poetry'] = null;
      if (isPoetry) {
        const misra = findMisraAt(editor, found.key, event.clientX, event.clientY);
        if (misra) {
          poetry = {
            coupletKey: misra.couplet[0].getKey(),
            coupletRect: toCanvas(unionRect(misra.coupletEls.map((el) => el.getBoundingClientRect())), canvas),
            lineKey: misra.couplet[misra.misraIndex].getKey(),
            lineRect: toCanvas(misra.lineEl.getBoundingClientRect(), canvas),
          };
        }
      }
      setHover({ blockKey: found.key, rect: toCanvas(found.el.getBoundingClientRect(), canvas), rtl, poetry });
    };
    const onMouseLeave = () => {
      if (!dragRef.current) setHover(null);
    };
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [canvas, editor]);

  // Drop targeting and the drop itself.
  useEffect(() => {
    if (!canvas) return;

    const targetFor = (event: DragEvent): { indicator: Indicator; apply: () => boolean } | null => {
      const drag = dragRef.current;
      if (!drag) return null;
      const y = event.clientY;
      const found = findTopLevelAt(editor, y, true);
      if (!found) return null;
      const isPoetry = editor.getEditorState().read(() => $isPoetryBlockNode($getNodeByKey(found.key)));

      if (drag.kind === 'line') {
        if (!isPoetry) return null;
        const misra = findMisraAt(editor, found.key, event.clientX, y);
        if (!misra) return null;
        const targetKey = misra.couplet[misra.misraIndex].getKey();
        if (targetKey === drag.key) return null;
        return {
          indicator: { kind: 'box', rect: toCanvas(misra.lineEl.getBoundingClientRect(), canvas) },
          apply: () => {
            const a = $getNodeByKey(drag.key);
            const b = $getNodeByKey(targetKey);
            return $isParagraphNode(a) && $isParagraphNode(b) ? $swapMisras(a, b) : false;
          },
        };
      }

      if (drag.kind === 'couplet' && isPoetry) {
        const misra = findMisraAt(editor, found.key, event.clientX, y);
        if (!misra) return null;
        const rect = unionRect(misra.coupletEls.map((el) => el.getBoundingClientRect()));
        const position = y >= rect.top + rect.height / 2 ? 'after' : 'before';
        const targetKey = misra.couplet[0].getKey();
        if (targetKey === drag.key) return null;
        return {
          indicator: { kind: 'line', rect: toCanvas(rect, canvas), edge: position === 'after' ? 'bottom' : 'top' },
          apply: () => {
            const dragged = $getNodeByKey(drag.key);
            const target = $getNodeByKey(targetKey);
            const source = dragged ? $getCoupletContaining(dragged) : null;
            const destination = target ? $getCoupletContaining(target) : null;
            if (!source || !destination) return false;
            return $moveCouplet(source.couplet, { kind: 'couplet', couplet: destination.couplet, position });
          },
        };
      }

      // A whole block, or a couplet leaving poetry: lands before/after a top-level block.
      const rect = found.el.getBoundingClientRect();
      const margins = verticalMargins(found.el);
      const position = y >= rect.top + rect.height / 2 ? 'after' : 'before';
      if (drag.kind === 'block' && found.key === drag.key) return null;
      const lineRect = toCanvas(rect, canvas);
      const indicatorRect =
        position === 'after'
          ? { ...lineRect, top: lineRect.top + lineRect.height + margins.bottom / 2 }
          : { ...lineRect, top: lineRect.top - margins.top / 2 };
      return {
        indicator: { kind: 'line', rect: indicatorRect, edge: 'top' },
        apply: () => {
          const target = $getNodeByKey(found.key);
          if (!target) return false;
          if (drag.kind === 'block') {
            const dragged = $getNodeByKey(drag.key);
            if (!dragged || dragged.is(target)) return false;
            if (position === 'after') target.insertAfter(dragged);
            else target.insertBefore(dragged);
            if ($isElementNode(dragged)) dragged.selectStart();
            return true;
          }
          const dragged = $getNodeByKey(drag.key);
          const source = dragged ? $getCoupletContaining(dragged) : null;
          if (!source) return false;
          return $moveCouplet(source.couplet, { kind: 'block', block: target, position });
        },
      };
    };

    return mergeRegister(
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (event) => {
          if (!dragRef.current || eventFiles(event)[0]) return false;
          const target = targetFor(event);
          setIndicator(target?.indicator ?? null);
          if (!target) return false;
          event.preventDefault(); // lets the drop fire
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (event) => {
          if (!dragRef.current || eventFiles(event)[0]) return false;
          const target = targetFor(event);
          // Finish here, not only in the grip's own dragend: a successful drop
          // re-renders (and unmounts) the grips before the browser fires
          // dragend on the one being dragged, so that handler never runs and
          // the overlays would stay inert until the page is reloaded.
          finishDrag(canvas);
          setHover(null);
          if (!target) return false;
          event.preventDefault();
          return target.apply();
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [canvas, editor]);

  if (!canvas || !hover || !editor.isEditable()) return null;

  const startDrag = (kind: DragKind, key: string, imageKey: string) => (event: ReactDragEvent<HTMLDivElement>) => {
    const dataTransfer = event.dataTransfer;
    const image = editor.getElementByKey(imageKey);
    if (!dataTransfer || !image) return;
    dataTransfer.setData(DRAG_DATA_FORMAT, key);
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setDragImage(image, 0, 0);
    dragRef.current = { kind, key };
    // The hover overlays (poetry "+" zones, table edge controls, the grips
    // themselves) sit right on the borders a drop lands on; this class turns
    // their pointer events off for the duration so they can't swallow it.
    canvas.closest('.likhari-root')?.classList.add(DRAGGING_CLASS);
  };
  const endDrag = () => finishDrag(canvas);

  const gripStyle = (rect: Rect, offset: number): CSSProperties => ({
    top: rect.top,
    left: hover.rtl ? rect.left + rect.width + GRIP_GAP_PX + offset : rect.left - GRIP_GAP_PX - GRIP_PX - offset,
  });

  const grip = (kind: DragKind, key: string, imageKey: string, rect: Rect, offset: number, label: string, Icon: typeof IconGripVertical) => (
    <div
      key={kind}
      className={`likhari-drag-grip likhari-drag-grip--${kind}`}
      style={gripStyle(rect, offset)}
      draggable
      title={label}
      aria-label={label}
      role="button"
      onDragStart={startDrag(kind, key, imageKey)}
      onDragEnd={endDrag}
    >
      <Icon size={14} stroke={2} />
    </div>
  );

  const grips = hover.poetry
    ? [
        grip('couplet', hover.poetry.coupletKey, hover.poetry.coupletKey, hover.poetry.lineRect, GRIP_PX + GRIP_GAP_PX, strings.dragHandle.couplet, IconGripVertical),
        grip('line', hover.poetry.lineKey, hover.poetry.lineKey, hover.poetry.lineRect, 0, strings.dragHandle.line, IconGripHorizontal),
      ]
    : [grip('block', hover.blockKey, hover.blockKey, hover.rect, 0, strings.dragHandle.block, IconGripVertical)];

  const indicatorEl =
    indicator &&
    (indicator.kind === 'box' ? (
      <div className="likhari-drag-target-box" style={{ top: indicator.rect.top, left: indicator.rect.left, width: indicator.rect.width, height: indicator.rect.height }} />
    ) : (
      <div
        className="likhari-drag-target-line"
        style={{ top: indicator.edge === 'bottom' ? indicator.rect.top + indicator.rect.height : indicator.rect.top, left: indicator.rect.left, width: indicator.rect.width }}
      />
    ));

  return createPortal(
    <>
      {grips}
      {indicatorEl}
    </>,
    canvas,
  );
}
