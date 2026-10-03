import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { usePortalTarget } from '../PortalTargetContext';
import { $getPoetryBlockFromSelection } from './poetryActions';
import { $isPoetryBlockNode } from './PoetryNode';

const MIN_WIDTH_PX = 160;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  rtl: boolean;
}

function measure(el: HTMLElement): Box {
  const box = el.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height, rtl: getComputedStyle(el).direction === 'rtl' };
}

/**
 * A floating drag handle over the currently-active poetry couplet's
 * inline-end edge, letting the user resize how wide the block reads on the
 * page — "size it according to the length of the couplet" — rather than
 * being stuck with editor.css's default max-width: 70%. Rendered as a
 * portal into the editor's own portal-target element, never as a child of
 * the couplet's own DOM, so it can't interfere with Lexical's
 * reconciliation of the couplet's real (editable) children.
 */
export function PoetryResizer() {
  const [editor] = useLexicalComposerContext();
  const portalSelector = usePortalTarget();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const dragStart = useRef<{ x: number; width: number; rtl: boolean } | null>(null);

  useEffect(() => {
    const recompute = () => {
      if (dragStart.current) return; // the pointermove handler owns `box` mid-drag
      editor.getEditorState().read(() => {
        const couplet = $getPoetryBlockFromSelection();
        const el = couplet ? editor.getElementByKey(couplet.getKey()) : null;
        if (!couplet || !el) {
          setActiveKey(null);
          setBox(null);
          return;
        }
        setActiveKey(couplet.getKey());
        setBox(measure(el));
      });
    };
    recompute();
    const unregister = editor.registerUpdateListener(recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      unregister();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [editor]);

  if (!box || !activeKey) return null;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, width: box.width, rtl: box.rtl };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    const el = editor.getElementByKey(activeKey);
    if (!start || !el) return;
    const delta = event.clientX - start.x;
    const signedDelta = start.rtl ? -delta : delta;
    const canvasMax = editor.getRootElement()?.clientWidth ?? start.width + signedDelta;
    const width = Math.round(Math.min(Math.max(start.width + signedDelta, MIN_WIDTH_PX), canvasMax));
    // Live visual feedback: the couplet is centered (margin: auto), so
    // resizing it moves both edges — re-measure after mutating rather than
    // computing the new position from the drag delta alone.
    el.style.maxWidth = `${width}px`;
    setBox(measure(el));
  };

  const onPointerUp = () => {
    const start = dragStart.current;
    dragStart.current = null;
    const el = editor.getElementByKey(activeKey);
    const width = el ? Math.round(el.getBoundingClientRect().width) : null;
    if (start && width !== null) {
      editor.update(() => {
        const node = $getNodeByKey(activeKey);
        if ($isPoetryBlockNode(node)) node.setWidth(width);
      });
    }
  };

  const handleX = box.rtl ? box.left : box.left + box.width;

  const handle = (
    <div
      className="likhari-poetry-resize-handle"
      style={{ position: 'fixed', top: box.top, left: handleX, height: box.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation="vertical"
    />
  );

  const portalRoot = portalSelector ? document.querySelector(portalSelector) : null;
  return portalRoot ? createPortal(handle, portalRoot) : handle;
}
