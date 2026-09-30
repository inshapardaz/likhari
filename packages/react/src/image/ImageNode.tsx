import { useCallback, useEffect, useRef, type ReactElement } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';

/** How the image's bytes are held: an external URL, or embedded in the
 * document (a base64 data URI, or a URL returned by the host's upload handler). */
export type ImageLinkType = 'linked' | 'embedded';

export interface ImagePayload {
  src: string;
  altText?: string;
  /** null = no caption; '' = caption enabled but empty */
  caption?: string | null;
  linkType: ImageLinkType;
  width?: number | null;
  height?: number | null;
  key?: NodeKey;
}

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
    caption: string | null;
    linkType: ImageLinkType;
    width: number | null;
    height: number | null;
  },
  SerializedLexicalNode
>;

/**
 * Block-level image (editor-architecture-design.md §3.5). The caption is a
 * plain string edited through an input under the image — not the nested
 * sub-editor the architecture doc leaves open — which keeps caption edits in
 * the parent editor's undo history.
 */
export class ImageNode extends DecoratorNode<ReactElement> {
  __src: string;
  __altText: string;
  __caption: string | null;
  __linkType: ImageLinkType;
  __width: number | null;
  __height: number | null;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__caption, node.__linkType, node.__width, node.__height, node.__key);
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: json.src,
      altText: json.altText,
      caption: json.caption,
      linkType: json.linkType,
      width: json.width,
      height: json.height,
    });
  }

  constructor(
    src: string,
    altText = '',
    caption: string | null = null,
    linkType: ImageLinkType = 'linked',
    width: number | null = null,
    height: number | null = null,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__caption = caption;
    this.__linkType = linkType;
    this.__width = width;
    this.__height = height;
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      caption: this.__caption,
      linkType: this.__linkType,
      width: this.__width,
      height: this.__height,
    };
  }

  /** `<figure><img><figcaption>` — the figure/figcaption semantics from spec §4.7. */
  exportDOM(): DOMExportOutput {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.setAttribute('src', this.__src);
    img.setAttribute('alt', this.__altText);
    if (this.__width) img.setAttribute('width', String(this.__width));
    if (this.__height) img.setAttribute('height', String(this.__height));
    figure.appendChild(img);
    if (this.__caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = this.__caption;
      figure.appendChild(caption);
    }
    return { element: figure };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    const className = config.theme.image;
    if (typeof className === 'string') div.className = className;
    return div;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  getCaption(): string | null {
    return this.__caption;
  }

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption;
    return writable;
  }

  getTextContent(): string {
    return this.__altText || this.__caption || '';
  }

  decorate(): ReactElement {
    return (
      <ImageComponent
        nodeKey={this.getKey()}
        src={this.__src}
        altText={this.__altText}
        caption={this.__caption}
        width={this.__width}
        height={this.__height}
      />
    );
  }
}

export function $createImageNode({ src, altText, caption, linkType, width, height, key }: ImagePayload): ImageNode {
  return new ImageNode(src, altText, caption ?? null, linkType, width ?? null, height ?? null, key);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

interface ImageComponentProps {
  nodeKey: NodeKey;
  src: string;
  altText: string;
  caption: string | null;
  width: number | null;
  height: number | null;
}

function ImageComponent({ nodeKey, src, altText, caption, width, height }: ImageComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const imageRef = useRef<HTMLImageElement | null>(null);

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

  // Delete/Backspace removes the selected image — but not while typing in the
  // caption input, whose keystrokes also reach the editor's root listener.
  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (!isSelected || event.target instanceof HTMLInputElement) return false;
      if (!$isNodeSelection($getSelection())) return false;
      event.preventDefault();
      $getNodeByKey(nodeKey)?.remove();
      return true;
    },
    [isSelected, nodeKey],
  );

  useEffect(() => {
    const unregisterDelete = editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW);
    const unregisterBackspace = editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW);
    return () => {
      unregisterDelete();
      unregisterBackspace();
    };
  }, [editor, onDelete]);

  const setCaption = (value: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) node.setCaption(value);
    });
  };

  return (
    <figure
      className="likhari-image-figure"
      data-selected={isSelected ? 'true' : 'false'}
      contentEditable={false}
    >
      <img
        ref={imageRef}
        className="likhari-image"
        src={src}
        alt={altText}
        width={width ?? undefined}
        height={height ?? undefined}
        draggable={false}
      />
      {caption !== null && (
        <input
          className="likhari-image-caption"
          type="text"
          aria-label="Image caption"
          placeholder="Add a caption…"
          value={caption}
          onChange={(e) => setCaption(e.currentTarget.value)}
        />
      )}
    </figure>
  );
}
