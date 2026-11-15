import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { IconPlus } from '@tabler/icons-react';
import { usePortalTarget } from '../PortalTargetContext';
import { useUiStrings } from '../i18n/useStrings';
import { $getCoupletFromSelection, $insertCoupletRelativeToSelection } from './poetryActions';

/** The affordance straddles the couplet's edge: this much of it sits above
 * (or below) the border, the rest overlaps the couplet itself. */
const ZONE_HEIGHT_PX = 14;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The bounding box of both misras together — one rectangle in every
 * layout (two stacked lines, one two-column row, one staggered pair). */
function measure(elements: HTMLElement[]): Box {
  const rects = elements.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { top, left, width: right - left, height: bottom - top };
}

/**
 * Two hover zones along the top and bottom borders of the couplet the caret
 * is in. Resting over either reveals a line across the border with a "+"
 * button that inserts an empty couplet above or below — the table-style
 * row-insert affordance for poetry, reachable without opening the poetry
 * menu. Like PoetryResizer, it's portaled next to (never inside) the
 * couplet's own DOM so it can't disturb Lexical's reconciliation, and it
 * only acts on the caret's couplet so the insert lands where the user is
 * working.
 */
export function PoetryCoupletInserter() {
  const [editor] = useLexicalComposerContext();
  const portalSelector = usePortalTarget();
  const strings = useUiStrings();
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const recompute = () => {
      if (!editor.isEditable()) {
        setBox(null);
        return;
      }
      editor.getEditorState().read(() => {
        const couplet = $getCoupletFromSelection();
        const elements = couplet ? couplet.map((misra) => editor.getElementByKey(misra.getKey())) : [];
        if (!couplet || elements.some((el) => el === null)) {
          setBox(null);
          return;
        }
        setBox(measure(elements as HTMLElement[]));
      });
    };
    recompute();
    const unregisterUpdate = editor.registerUpdateListener(recompute);
    const unregisterEditable = editor.registerEditableListener(recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      unregisterUpdate();
      unregisterEditable();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [editor]);

  if (!box) return null;

  const insert = (position: 'before' | 'after') => {
    editor.update(() => {
      $insertCoupletRelativeToSelection(position);
    });
  };

  const zone = (position: 'before' | 'after') => {
    const edge = position === 'before' ? box.top : box.top + box.height;
    const label = position === 'before' ? strings.poetryMenu.insertCoupletBefore : strings.poetryMenu.insertCoupletAfter;
    return (
      <div
        key={position}
        className="likhari-edge-zone"
        style={{ position: 'fixed', top: edge - ZONE_HEIGHT_PX / 2, left: box.left, width: box.width, height: ZONE_HEIGHT_PX }}
      >
        <button
          type="button"
          className="likhari-edge-button"
          title={label}
          aria-label={label}
          // Keep the caret where it is: the insert is relative to the caret's
          // couplet, and focus must stay in the editor for the new misra to
          // receive it afterward.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => insert(position)}
        >
          <IconPlus size={12} stroke={2.5} />
        </button>
      </div>
    );
  };

  const zones = (
    <>
      {zone('before')}
      {zone('after')}
    </>
  );

  const portalRoot = portalSelector ? document.querySelector(portalSelector) : null;
  return portalRoot ? createPortal(zones, portalRoot) : zones;
}
