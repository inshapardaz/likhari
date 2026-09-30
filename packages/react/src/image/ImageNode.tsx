import type { ReactElement } from 'react';
import {
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { ImageComponent } from './ImageComponent';

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
 * plain string (null = no caption) edited through the image's right-click menu
 * / edit dialog — not the nested sub-editor the architecture doc leaves open —
 * which keeps every edit in the parent editor's undo history.
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

  getLinkType(): ImageLinkType {
    return this.__linkType;
  }

  getWidth(): number | null {
    return this.__width;
  }

  getHeight(): number | null {
    return this.__height;
  }

  setCaption(caption: string | null): this {
    const writable = this.getWritable();
    writable.__caption = caption || null;
    return writable;
  }

  setAltText(altText: string): this {
    const writable = this.getWritable();
    writable.__altText = altText;
    return writable;
  }

  /** Points the node at new image data (a replaced URL/upload, or edited pixels). */
  setSource(src: string, linkType: ImageLinkType): this {
    const writable = this.getWritable();
    writable.__src = src;
    writable.__linkType = linkType;
    return writable;
  }

  /** Display size in px; null = the image's natural size. */
  setDimensions(width: number | null, height: number | null): this {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
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
        linkType={this.__linkType}
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
