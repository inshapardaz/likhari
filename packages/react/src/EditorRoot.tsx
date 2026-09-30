import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MantineThemeOverride } from '@mantine/core';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { EditorState, SerializedEditorState } from 'lexical';
import { defaultFormatRegistry, type FormatId } from '@inshapardaz/likhari-converters';
import { resolveFeatureConfig, type EditorFeatureConfig, type FeatureConfigPresetName } from '@inshapardaz/likhari-core';
import { EDITOR_NODES } from './nodes';
import { editorTheme } from './theme/editorTheme';
import { EditorThemeProvider } from './theme/EditorThemeProvider';
import { Toolbar } from './components/Toolbar';
import { injectUrduWebFontsCss, type FontOption } from './fonts';
import { LinkPastePlugin } from './plugins/LinkPastePlugin';
import { ImageOptionsContext, type ImageOptions } from './image/ImageOptionsContext';
import { PortalTargetContext } from './PortalTargetContext';
import { UiStringsContext, getStrings, type Locale } from './i18n';

export interface EditorInitialContent {
  format: Extract<FormatId, 'lexical-json' | 'plain-text'>;
  value: string;
}

export interface EditorRootProps {
  documentId?: string;
  initialContent?: EditorInitialContent;
  featureConfig?: EditorFeatureConfig;
  featurePreset?: FeatureConfigPresetName;
  theme?: MantineThemeOverride;
  colorScheme?: 'light' | 'dark';
  /**
   * A CSS color (e.g. `'#2B6E6E'`) overriding the editor's default accent —
   * both Mantine's own primary color (buttons, portaled dropdowns' active-item
   * highlight, etc.) and the `--editor-accent` / `--editor-accent-soft` CSS
   * variables the toolbar/canvas use directly. Omit to use the built-in
   * default tokens (packages/core/src/theme/tokens.ts).
   */
  accentColor?: string;
  locale?: Locale;
  placeholder?: string;
  /**
   * CSS height for the editor box (toolbar + canvas together) — accepts any
   * CSS length, e.g. '100%' to fill a sized parent, '60vh', or a number of
   * pixels. The canvas scrolls internally once its content exceeds this,
   * rather than the editor (and the page around it) growing without bound.
   * Defaults to a fixed height so the editor has a sane size out of the box
   * even when the host hasn't given its container an explicit height.
   */
  height?: string | number;
  onChange?: (state: SerializedEditorState) => void;
  /**
   * Handler for the toolbar's Save button. Receives the serialized content
   * (plain text when that format is enabled, otherwise Lexical JSON).
   */
  onSave?: (content: string, format: FormatId) => void;
  /**
   * Whether the Save button (icon-only) is shown. Defaults to `true` when
   * `onSave` is provided and `false` otherwise, i.e. the previous behavior.
   * Set explicitly to show the button without a handler (saving still clears
   * the unsaved-changes state) or to hide it while keeping `onSave`.
   */
  showSave?: boolean;
  /**
   * Stores an uploaded image and returns the URL to reference it by. Without
   * it, uploaded images are embedded in the document as base64 data URIs —
   * simple, but they bloat the document (see `images.maxSizeMB`).
   */
  onImageUpload?: (file: File) => Promise<string>;
  /**
   * Downloads a linked image's bytes when converting it to an embedded copy
   * or applying a crop/rotate/flip. Without it, the browser fetches the URL
   * directly, which fails for any image server that doesn't send CORS
   * headers — that restriction can't be worked around from the browser
   * alone. Provide this to route the request through your own backend (or a
   * CORS proxy) instead.
   */
  fetchImage?: (url: string) => Promise<Blob>;
  /**
   * Entries for the toolbar's font-family dropdown. Defaults to
   * `DEFAULT_FONT_OPTIONS` (generic Latin faces plus the Urdu/Arabic-script
   * collection from inshapardaz/urdu-web-fonts, the same source qari uses).
   * Spread the defaults to add your own, e.g.
   * `[...DEFAULT_FONT_OPTIONS, { name: 'Mine', family: '"Mine", serif' }]`.
   */
  fontOptions?: FontOption[];
}

export interface EditorRef {
  getContent(format: FormatId): string;
  setContent(value: string, format: FormatId): void;
  hasUnsavedChanges(): boolean;
  confirmDiscard(): Promise<boolean>;
  focus(): void;
}

function initialEditorStateJson(initialContent?: EditorInitialContent): string | undefined {
  if (!initialContent) return undefined;
  const state = defaultFormatRegistry.parse(initialContent.format, initialContent.value);
  return JSON.stringify(state);
}

export const EditorRoot = forwardRef<EditorRef, EditorRootProps>(function EditorRoot(
  {
    documentId,
    initialContent,
    featureConfig,
    featurePreset,
    theme,
    colorScheme,
    accentColor,
    locale = 'en',
    placeholder,
    height = '480px',
    onChange,
    onSave,
    showSave = Boolean(onSave),
    onImageUpload,
    fetchImage,
    fontOptions,
  },
  ref,
) {
  const config = useMemo(() => resolveFeatureConfig(featureConfig, featurePreset), [featureConfig, featurePreset]);
  const strings = useMemo(() => getStrings(locale), [locale]);
  const resolvedPlaceholder = placeholder ?? strings.editor.placeholder;
  // The urdu-web-fonts stylesheets are needed for the font dropdown and for
  // RTL content, whose canvas font (editor.css) is one of those families.
  useEffect(() => {
    if (config.font.family || locale !== 'en') injectUrduWebFontsCss();
  }, [config.font.family, locale]);

  const imageOptions = useMemo<ImageOptions>(
    () => ({
      allowLinked: config.images.linked,
      allowEmbedded: config.images.embedded,
      allowCaption: config.images.caption,
      maxSizeMB: config.images.maxSizeMB,
      onImageUpload,
      fetchImage,
    }),
    [config.images.linked, config.images.embedded, config.images.caption, config.images.maxSizeMB, onImageUpload, fetchImage],
  );

  const editorStateRef = useRef<EditorState | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const initialConfig = useMemo(
    () => ({
      namespace: `likhari-editor-${documentId ?? 'anonymous'}`,
      nodes: EDITOR_NODES,
      theme: editorTheme,
      editorState: initialEditorStateJson(initialContent),
      onError(error: Error) {
        throw error;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useImperativeHandle(
    ref,
    (): EditorRef => ({
      getContent(format) {
        if (!editorStateRef.current) return '';
        const json = editorStateRef.current.toJSON();
        return defaultFormatRegistry.serialize(format, json);
      },
      setContent(value, format) {
        // Applied on next render via editorState prop is not supported for
        // an already-mounted LexicalComposer; hosts needing this before
        // Phase 2's controlled-mode support should remount with a new
        // `initialContent`/`documentId` in the meantime.
        void value;
        void format;
        throw new Error(
          '@inshapardaz/likhari-react: EditorRef.setContent is not implemented yet — controlled mode is Phase 2 work (docs/editor-architecture-design.md §5).',
        );
      },
      hasUnsavedChanges() {
        return isDirty;
      },
      async confirmDiscard() {
        if (!isDirty) return true;
        if (typeof window === 'undefined') return true;
        return window.confirm(strings.editor.confirmDiscard);
      },
      focus() {
        rootElementRef.current?.focus();
      },
    }),
    [isDirty, strings],
  );

  const rootElementRef = useRef<HTMLDivElement | null>(null);

  const handleChange = (state: EditorState) => {
    editorStateRef.current = state;
    const json = JSON.stringify(state.toJSON());
    setIsDirty(json !== lastSavedJsonRef.current);
    onChange?.(state.toJSON());
  };

  const handleSave = () => {
    if (!editorStateRef.current) return;
    const json = editorStateRef.current.toJSON();
    const format: FormatId = config.formats.plainText ? 'plain-text' : 'lexical-json';
    const content = defaultFormatRegistry.serialize(format, json);
    lastSavedJsonRef.current = JSON.stringify(json);
    setIsDirty(false);
    onSave?.(content, format);
  };

  const dir = locale === 'en' ? 'ltr' : 'rtl';

  // A stable per-instance id for the portal-anchor div below, so multiple
  // EditorRoot instances on one page each get their own portal target
  // rather than colliding on a shared one.
  const portalTargetId = useId();
  const portalTargetSelector = `#${CSS.escape(portalTargetId)}`;

  return (
    <EditorThemeProvider theme={theme} colorScheme={colorScheme} accentColor={accentColor} scopeElementId={portalTargetId}>
      <div
        className="likhari-root"
        dir={dir}
        ref={rootElementRef}
        data-document-id={documentId}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {/* Empty portal-anchor: a genuine DOM descendant of both
            .likhari-theme-scope (carries the --editor-* vars) and
            .likhari-root (carries `dir`) for Mantine's portaled Menu/Modal/
            Select-combobox/Tooltip content to render into, so that content
            inherits the editor's theme and text direction instead of
            escaping to <body> unstyled (see PortalTargetContext.tsx). */}
        <div id={portalTargetId} className="likhari-portal-target" />
        <PortalTargetContext.Provider value={portalTargetSelector}>
        <UiStringsContext.Provider value={strings}>
        <ImageOptionsContext.Provider value={imageOptions}>
        <LexicalComposer initialConfig={initialConfig}>
          <Toolbar config={config} onSave={handleSave} isDirty={isDirty} showSave={showSave} fontOptions={fontOptions} direction={dir} locale={locale} />
          <div className="likhari-canvas">
            <RichTextPlugin
              contentEditable={<ContentEditable className="likhari-content-editable" dir={dir} aria-label={strings.editor.contentLabel} />}
              placeholder={<div className="likhari-placeholder">{resolvedPlaceholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          {config.history && <HistoryPlugin />}
          {(config.lists.bullet || config.lists.numbered || config.lists.check) && <ListPlugin />}
          {config.lists.check && <CheckListPlugin />}
          {config.links && <LinkPlugin />}
          {config.links && <LinkPastePlugin />}
          <OnChangePlugin onChange={handleChange} />
        </LexicalComposer>
        </ImageOptionsContext.Provider>
        </UiStringsContext.Provider>
        </PortalTargetContext.Provider>
      </div>
    </EditorThemeProvider>
  );
});
