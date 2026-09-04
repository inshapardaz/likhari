import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MantineThemeOverride } from '@mantine/core';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { EditorState, SerializedEditorState } from 'lexical';
import { defaultFormatRegistry, type FormatId } from '@likhari/converters';
import { resolveFeatureConfig, type EditorFeatureConfig, type FeatureConfigPresetName } from '@likhari/core';
import { EDITOR_NODES } from './nodes';
import { editorTheme } from './theme/editorTheme';
import { EditorThemeProvider } from './theme/EditorThemeProvider';
import { Toolbar } from './components/Toolbar';

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
  locale?: 'en' | 'ur' | 'pa-shahmukhi';
  placeholder?: string;
  onChange?: (state: SerializedEditorState) => void;
  onSave?: (content: string, format: FormatId) => void;
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
    locale = 'en',
    placeholder = 'Start writing…',
    onChange,
    onSave,
  },
  ref,
) {
  const config = useMemo(() => resolveFeatureConfig(featureConfig, featurePreset), [featureConfig, featurePreset]);
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
          '@likhari/editor-react: EditorRef.setContent is not implemented yet — controlled mode is Phase 2 work (docs/editor-architecture-design.md §5).',
        );
      },
      hasUnsavedChanges() {
        return isDirty;
      },
      async confirmDiscard() {
        if (!isDirty) return true;
        if (typeof window === 'undefined') return true;
        return window.confirm('You have unsaved changes. Discard them?');
      },
      focus() {
        rootElementRef.current?.focus();
      },
    }),
    [isDirty],
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

  return (
    <EditorThemeProvider theme={theme} colorScheme={colorScheme}>
      <div className="likhari-root" dir={dir} ref={rootElementRef} data-document-id={documentId}>
        <LexicalComposer initialConfig={initialConfig}>
          <Toolbar config={config} onSave={onSave ? handleSave : undefined} isDirty={isDirty} showSave={Boolean(onSave)} />
          <div className="likhari-canvas">
            <RichTextPlugin
              contentEditable={<ContentEditable className="likhari-content-editable" dir={dir} aria-label="Editor content" />}
              placeholder={<div className="likhari-placeholder">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          {config.history && <HistoryPlugin />}
          {(config.lists.bullet || config.lists.numbered || config.lists.check) && <ListPlugin />}
          {config.links && <LinkPlugin />}
          <OnChangePlugin onChange={handleChange} />
        </LexicalComposer>
      </div>
    </EditorThemeProvider>
  );
});
