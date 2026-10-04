import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorRoot, type EditorRef, type EditorRootProps } from '@inshapardaz/likhari-react';
import type { EditorFeatureConfig } from '@inshapardaz/likhari-core';
import type { FormatId } from '@inshapardaz/likhari-converters';
import { attributesToProps, OBSERVED_ATTRIBUTES } from './attributes';

/**
 * `<likhari-editor>`: the React editor as a custom element.
 *
 * Simple settings are attributes (`locale="ur"`, `show-save`, ...). The feature
 * config is a property (`element.featureConfig = {...}`) because it is nested.
 * Changes and saves are CustomEvents: `editor-change` (detail: the editor state)
 * and `editor-save` (detail: `{ content, format }`). Methods mirror the React
 * EditorRef: `getContent`, `setContent`, `hasUnsavedChanges`, `confirmDiscard`,
 * `focus`.
 *
 * The element renders into light DOM, not a shadow root: the editor's portals
 * (menus, dialogs) are found by a document-level selector, which a shadow root
 * would hide. Its styles are added once to the document head instead.
 */
export class LikhariEditorElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRIBUTES;
  }

  private root: Root | null = null;
  private handle: EditorRef | null = null;
  private config: EditorFeatureConfig | undefined;

  get featureConfig(): EditorFeatureConfig | undefined {
    return this.config;
  }

  set featureConfig(value: EditorFeatureConfig | undefined) {
    this.config = value;
    this.render();
  }

  connectedCallback(): void {
    if (!this.root) this.root = createRoot(this);
    this.render();
  }

  disconnectedCallback(): void {
    this.root?.unmount();
    this.root = null;
    this.handle = null;
  }

  attributeChangedCallback(): void {
    this.render();
  }

  getContent(format: FormatId): string {
    return this.handle?.getContent(format) ?? '';
  }

  setContent(value: string, format: FormatId): void {
    this.handle?.setContent(value, format);
  }

  hasUnsavedChanges(): boolean {
    return this.handle?.hasUnsavedChanges() ?? false;
  }

  confirmDiscard(): Promise<boolean> {
    return this.handle?.confirmDiscard() ?? Promise.resolve(true);
  }

  focus(): void {
    this.handle?.focus();
  }

  private render(): void {
    if (!this.root) return;
    const props: EditorRootProps = {
      ...attributesToProps((name) => this.getAttribute(name)),
      ...(this.config ? { featureConfig: this.config } : {}),
      onChange: (state) => this.emit('editor-change', state),
      onSave: (content, format) => this.emit('editor-save', { content, format }),
    };
    const ref = (handle: EditorRef | null) => {
      this.handle = handle;
    };
    this.root.render(createElement(EditorRoot, { ...props, ref }));
  }

  private emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

/** Registers `<likhari-editor>` once, so importing the package in several places is safe. */
export function defineLikhariEditor(name = 'likhari-editor'): void {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, LikhariEditorElement);
}
