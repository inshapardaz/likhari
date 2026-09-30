import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Menu } from '@mantine/core';
import { IconCrop, IconPhotoDown, IconPhotoEdit, IconTextCaption, IconTrash, IconX } from '@tabler/icons-react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalNode,
  type NodeKey,
} from 'lexical';
import { ImageCropDialog, type ImageCropDialogValue } from './ImageCropDialog';
import { ImageDialog, type ImageDialogValue } from './ImageDialog';
import { useImageOptions } from './ImageOptionsContext';
import { useUiStrings } from '../i18n/useStrings';
import { dataUrlBytes, fetchImageAsDataUrl } from './imageEdit';
import type { ImageLinkType, ImageNode } from './ImageNode';

// A type-only import of ImageNode (ImageNode itself imports this file), so the
// node is recognised by its type string rather than `instanceof`.
function isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node?.getType() === 'image';
}

const MIN_WIDTH = 32;

interface ImageComponentProps {
  nodeKey: NodeKey;
  src: string;
  altText: string;
  caption: string | null;
  linkType: ImageLinkType;
  /** Display width in px; null = natural size (height always follows the aspect ratio). */
  width: number | null;
  height: number | null;
}

/**
 * An image in the document. Click selects it (Delete/Backspace removes it),
 * drag the corner handle to resize an embedded image, double-click or
 * right-click for the edit dialog and menu (edit image, convert a linked image
 * to embedded, add/edit/remove caption, delete). The caption
 * is shown as plain text under the image — it is edited in the dialog, not in
 * place.
 */
export function ImageComponent({ nodeKey, src, altText, caption, linkType, width, height }: ImageComponentProps) {
  const [editor] = useLexicalComposerContext();
  const options = useImageOptions();
  const strings = useUiStrings();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [dialog, setDialog] = useState<{ intent?: 'caption' | 'convert' } | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

  // Selecting must go through CLICK_COMMAND (returning true) rather than a
  // React onClick: otherwise Lexical's own click handling turns the DOM
  // selection into a range selection right after, undoing the node selection.
  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        if (event.target !== imageRef.current) return false;
        clearSelection();
        setSelected(true);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, clearSelection, setSelected]);

  const removeImage = useCallback(() => {
    editor.update(() => {
      $getNodeByKey(nodeKey)?.remove();
    });
  }, [editor, nodeKey]);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (!isSelected || dialog || cropDialogOpen || menu) return false;
      if (!$isNodeSelection($getSelection())) return false;
      event.preventDefault();
      $getNodeByKey(nodeKey)?.remove();
      return true;
    },
    [isSelected, dialog, cropDialogOpen, menu, nodeKey],
  );

  useEffect(() => {
    const unregisterDelete = editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW);
    const unregisterBackspace = editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW);
    return () => {
      unregisterDelete();
      unregisterBackspace();
    };
  }, [editor, onDelete]);

  const updateNode = (change: (node: ImageNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (isImageNode(node)) change(node);
    });
  };

  // Converting from the context menu (as opposed to the "Crop & size" tab's
  // checkbox) needs no review: just download and swap the source in place.
  // Only on failure do we fall back to the full dialog, which shows the error
  // and lets the person retry or pick a different image.
  const convertToEmbedded = useCallback(async () => {
    try {
      const dataUrl = await fetchImageAsDataUrl(src, options.fetchImage);
      if (dataUrlBytes(dataUrl) > options.maxSizeMB * 1024 * 1024) {
        throw new Error(strings.imageDialog.errors.largerThan(options.maxSizeMB));
      }
      updateNode((node) => node.setSource(dataUrl, 'embedded'));
    } catch {
      setDialog({ intent: 'convert' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, options.fetchImage, options.maxSizeMB]);

  const applyEdit = (value: ImageDialogValue) => {
    updateNode((node) => {
      node.setSource(value.src, value.linkType);
      node.setAltText(value.altText);
      node.setCaption(value.caption);
      // A changed source has new pixels the current display size may no
      // longer fit — reset to auto. Editing alt text/caption only keeps it.
      if (value.sourceChanged) node.setDimensions(null, null);
    });
    setDialog(null);
    editor.focus();
  };

  const applyCrop = (value: ImageCropDialogValue) => {
    updateNode((node) => {
      node.setSource(value.src, 'embedded');
      node.setDimensions(value.width, value.height);
    });
    setCropDialogOpen(false);
    editor.focus();
  };

  // --- drag-to-resize: bottom-right handle, aspect ratio kept ---------------
  const resizeStart = useRef<{ x: number; width: number; ratio: number; max: number } | null>(null);

  const onResizeDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const img = imageRef.current;
    if (!img) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = img.getBoundingClientRect();
    resizeStart.current = {
      x: event.clientX,
      width: box.width,
      ratio: img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : box.height / box.width,
      max: figureRef.current?.clientWidth ?? box.width,
    };
    setLiveWidth(box.width);
  };

  const onResizeMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    setLiveWidth(Math.round(Math.min(Math.max(start.width + (event.clientX - start.x), MIN_WIDTH), start.max)));
  };

  const onResizeUp = () => {
    const start = resizeStart.current;
    resizeStart.current = null;
    if (start && liveWidth !== null) {
      const w = Math.round(liveWidth);
      updateNode((node) => node.setDimensions(w, Math.round(w * start.ratio)));
    }
    setLiveWidth(null);
  };

  const shownWidth = liveWidth ?? width ?? undefined;

  return (
    <figure
      ref={figureRef}
      className="likhari-image-figure"
      data-selected={isSelected ? 'true' : 'false'}
      contentEditable={false}
      onDoubleClick={(e) => {
        if (e.target === imageRef.current) setDialog({});
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        clearSelection();
        setSelected(true);
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <span className="likhari-image-wrap">
        <img
          ref={imageRef}
          className="likhari-image"
          src={src}
          alt={altText}
          width={shownWidth}
          draggable={false}
        />
        {isSelected && linkType === 'embedded' && (
          <span
            className="likhari-image-resize-handle"
            role="separator"
            aria-label={strings.imageMenu.resizeImage}
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
          />
        )}
      </span>
      {caption && <figcaption className="likhari-image-caption">{caption}</figcaption>}

      <Menu
        opened={menu !== null}
        onChange={(opened) => {
          if (!opened) setMenu(null);
        }}
        position="bottom-start"
        withinPortal
        shadow="sm"
        width={200}
      >
        <Menu.Target>
          {/* Invisible 1px anchor positioned at the right-click */}
          <span
            aria-hidden="true"
            style={{ position: 'fixed', left: menu?.x ?? -9999, top: menu?.y ?? -9999, width: 1, height: 1, pointerEvents: 'none' }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconPhotoEdit size={16} stroke={1.75} />} onClick={() => setDialog({})}>
            {strings.imageMenu.editImage}
          </Menu.Item>
          {linkType === 'linked' && options.allowEmbedded && (
            <Menu.Item leftSection={<IconPhotoDown size={16} stroke={1.75} />} onClick={() => void convertToEmbedded()}>
              {strings.imageMenu.convertToEmbedded}
            </Menu.Item>
          )}
          {linkType === 'embedded' && (
            <Menu.Item leftSection={<IconCrop size={16} stroke={1.75} />} onClick={() => setCropDialogOpen(true)}>
              {strings.imageMenu.cropResize}
            </Menu.Item>
          )}
          {options.allowCaption && (
            <Menu.Item leftSection={<IconTextCaption size={16} stroke={1.75} />} onClick={() => setDialog({ intent: 'caption' })}>
              {caption ? strings.imageMenu.editCaption : strings.imageMenu.addCaption}
            </Menu.Item>
          )}
          {options.allowCaption && caption && (
            <Menu.Item leftSection={<IconX size={16} stroke={1.75} />} onClick={() => updateNode((node) => node.setCaption(null))}>
              {strings.imageMenu.removeCaption}
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<IconTrash size={16} stroke={1.75} />} onClick={removeImage}>
            {strings.imageMenu.deleteImage}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <ImageDialog
        mode="edit"
        opened={dialog !== null}
        initial={{ src, altText, caption, linkType }}
        intent={dialog?.intent}
        onSubmit={applyEdit}
        onClose={() => {
          setDialog(null);
          editor.focus();
        }}
      />

      {linkType === 'embedded' && (
        <ImageCropDialog
          opened={cropDialogOpen}
          initial={{ src, width, height }}
          onSubmit={applyCrop}
          onClose={() => {
            setCropDialogOpen(false);
            editor.focus();
          }}
        />
      )}
    </figure>
  );
}
