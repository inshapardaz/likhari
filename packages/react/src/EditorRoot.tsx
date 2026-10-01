import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MantineThemeOverride } from '@mantine/core';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
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
import { DraftRestore, type DraftRestoreMode } from './components/DraftRestore';
import { LeaveDialog } from './components/LeaveDialog';
import {
  clearDraft,
  createDraftId,
  hasDraftContent,
  pruneDrafts,
  writeDraft,
  type DraftEntry,
} from './persistence/draftStorage';
import { ImageOptionsContext, type ImageOptions } from './image/ImageOptionsContext';
import { PortalTargetContext } from './PortalTargetContext';
import { UiStringsContext, getStrings, type Locale } from './i18n';

const DEFAULT_AUTOSAVE_DELAY_MS = 750;
const DEFAULT_AUTOSAVE_MAX_BYTES = 2_000_000;
const DEFAULT_AUTOSAVE_MAX_DRAFTS = 20;

/** What happens when the user is about to leave with unsaved changes. */
export type NavigationGuardMode = 'confirm' | 'save-draft' | 'off';

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
  /**
   * Saves drafts: a debounced autosave of the current content to
   * `localStorage` (lexical-editor-spec.md §6.2), a resilience net against an
   * accidental tab close that is independent of `onSave`/the Save button. The
   * draft is stored under `documentId` when you give one (§6.1); without one, a
   * unique id is generated for this editor, so editors never overwrite each
   * other's drafts. The toolbar's Drafts button lists every draft in the browser
   * to restore or delete. A draft is cleared on a successful explicit save.
   * Defaults to `true`.
   */
  autosave?: boolean;
  /**
   * What to do on mount when a draft of this `documentId` newer than the initial
   * content exists (needs `documentId`):
   * - `'prompt'` (default): a banner with Restore / Ignore / Remove draft;
   * - `'auto'`: load the draft straight away, no questions (see `onDraftRestored`);
   * - `'off'`: keep the initial content; the draft is moved aside into the drafts
   *   list so new edits don't overwrite it unseen.
   */
  restoreDraft?: DraftRestoreMode;
  /**
   * What happens when the user is about to leave with unsaved changes, for both
   * `EditorRef.confirmDiscard()` (in-app navigation, which your router guard
   * calls) and for closing or refreshing the tab:
   * - `'confirm'` (default): `confirmDiscard()` opens an in-editor popup (Save /
   *   Discard / Save draft / Cancel). On closing or refreshing the tab no
   *   popup is possible, and a draft is saved instead when `autosave` is on, so the
   *   browser's own "leave this page?" prompt is skipped; it only appears as a last
   *   resort, when no draft could be stored (autosave off, document over
   *   `autosaveMaxBytes`, storage unavailable);
   * - `'save-draft'`: silently saves a draft and lets the user go — no popup, no
   *   browser prompt. Works even with `autosave={false}`. If the draft can't be
   *   stored (e.g. the document is over `autosaveMaxBytes`) `confirmDiscard()` falls
   *   back to the popup, so work is never lost silently;
   * - `'off'`: no guard; the user is never asked.
   */
  navigationGuard?: NavigationGuardMode;
  /** Called when a saved draft was loaded into the editor (banner Restore, or `restoreDraft="auto"`). */
  onDraftRestored?: (draft: { documentId: string; savedAt: number }) => void;
  /** Debounce delay before writing an autosave draft, in ms. Default `750`. */
  autosaveDelayMs?: number;
  /**
   * Skips (rather than throwing) an autosave write whose JSON would exceed
   * this size — `localStorage` has a shared ~5-10MB per-origin ceiling, so a
   * single document with embedded base64 images must not be allowed to
   * autosave past a sane limit. Default `2_000_000` (~2MB).
   */
  autosaveMaxBytes?: number;
  /**
   * How many drafts to keep in the browser, across all documents; the oldest
   * beyond this are deleted as new ones are written (this editor's own draft
   * is never pruned). Default `20`.
   */
  autosaveMaxDrafts?: number;
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
    autosave = true,
    restoreDraft = 'prompt',
    navigationGuard = 'confirm',
    onDraftRestored,
    autosaveDelayMs = DEFAULT_AUTOSAVE_DELAY_MS,
    autosaveMaxBytes = DEFAULT_AUTOSAVE_MAX_BYTES,
    autosaveMaxDrafts = DEFAULT_AUTOSAVE_MAX_DRAFTS,
  },
  ref,
) {
  const config = useMemo(() => resolveFeatureConfig(featureConfig, featurePreset), [featureConfig, featurePreset]);
  const strings = useMemo(() => getStrings(locale), [locale]);
  const resolvedPlaceholder = placeholder ?? strings.editor.placeholder;
  // The draft's storage key: the host's documentId, else — so editors without
  // one never overwrite each other — a unique id generated for this editor (or
  // the id of an anonymous draft the user restored into it).
  const [generatedDraftId] = useState(createDraftId);
  const [adoptedDraftId, setAdoptedDraftId] = useState<string | null>(null);
  const draftId = documentId ?? adoptedDraftId ?? generatedDraftId;
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
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest change not yet written, so unload / unmount can flush it.
  const pendingDraftRef = useRef<{ id: string; json: string } | null>(null);

  const flushDraft = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = null;
    if (!pending) return;
    // A document that is blank again isn't worth a draft.
    if (hasDraftContent(pending.json)) {
      writeDraft(pending.id, pending.json, autosaveMaxBytes);
      pruneDrafts(autosaveMaxDrafts, [pending.id]);
    } else {
      clearDraft(pending.id);
    }
  };
  const flushDraftRef = useRef(flushDraft);
  flushDraftRef.current = flushDraft;

  /** Writes the latest content as a draft now, without waiting out the debounce.
   * Returns whether it is safely stored (or there was nothing worth storing). */
  const saveDraftNow = (): boolean => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const latest = editorStateRef.current ? JSON.stringify(editorStateRef.current.toJSON()) : pendingDraftRef.current?.json;
    pendingDraftRef.current = null;
    if (!latest) return true;
    // A blank document isn't worth a draft.
    if (!hasDraftContent(latest)) {
      clearDraft(draftId);
      return true;
    }
    const stored = writeDraft(draftId, latest, autosaveMaxBytes);
    if (stored) pruneDrafts(autosaveMaxDrafts, [draftId]);
    return stored;
  };
  const saveDraftNowRef = useRef(saveDraftNow);
  saveDraftNowRef.current = saveDraftNow;
  const navigationGuardRef = useRef(navigationGuard);
  navigationGuardRef.current = navigationGuard;
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;

  // The in-editor "leave?" popup behind confirmDiscard().
  const [leavePrompt, setLeavePrompt] = useState<{ draftFailed: boolean } | null>(null);
  const leaveResolveRef = useRef<((canLeave: boolean) => void) | null>(null);
  const settleLeave = (canLeave: boolean) => {
    const resolve = leaveResolveRef.current;
    leaveResolveRef.current = null;
    setLeavePrompt(null);
    resolve?.(canLeave);
  };
  const askToLeave = (draftFailed = false) =>
    new Promise<boolean>((resolve) => {
      leaveResolveRef.current?.(false); // a second call supersedes an unanswered one
      leaveResolveRef.current = resolve;
      setLeavePrompt({ draftFailed });
    });
  const confirmDiscardImpl = async (): Promise<boolean> => {
    if (!isDirtyRef.current || navigationGuard === 'off') return true;
    if (navigationGuard === 'save-draft') {
      if (saveDraftNow()) return true;
      return askToLeave(true);
    }
    return askToLeave();
  };
  const confirmDiscardRef = useRef(confirmDiscardImpl);
  confirmDiscardRef.current = confirmDiscardImpl;
  // An unanswered popup must not leave a caller's promise hanging if the editor goes away.
  useEffect(() => () => leaveResolveRef.current?.(false), []);

  // Computed once, before the first autosave write could possibly run, so
  // the restore-prompt plugin below can tell a stored draft that's merely
  // identical to the initial content apart (no prompt needed) from one that
  // actually represents newer, unsaved work.
  const initialContentJsonRef = useRef<string | undefined>(undefined);
  if (initialContentJsonRef.current === undefined) {
    initialContentJsonRef.current = initialEditorStateJson(initialContent);
  }

  const initialConfig = useMemo(
    () => ({
      namespace: `likhari-editor-${documentId ?? 'anonymous'}`,
      nodes: EDITOR_NODES,
      theme: editorTheme,
      editorState: initialContentJsonRef.current,
      onError(error: Error) {
        throw error;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // beforeunload (lexical-editor-spec.md §6.4): the automatic half of the
  // navigation guard — hasUnsavedChanges()/confirmDiscard() below are the
  // imperative half a host's own router guard calls for in-app navigation,
  // which the editor can't intercept on its own.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Write any edit still waiting out the debounce before the page goes.
      flushDraftRef.current();
      if (!isDirtyRef.current) return;
      const guard = navigationGuardRef.current;
      if (guard === 'off') return;
      // The work is saved as a draft (restorable from the banner / drafts list
      // when the page is opened again), so there is nothing to warn about and
      // the browser's prompt is skipped. It only appears as a last resort, when
      // no draft could be stored (autosave off, document too large, storage
      // unavailable) — a page can't customise or replace it, and it is the only
      // thing between the user and silently losing their work.
      if ((guard === 'save-draft' || autosaveRef.current) && saveDraftNowRef.current()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Unmounting (e.g. in-app navigation) also writes what is still pending.
  useEffect(() => () => flushDraftRef.current(), []);

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
      confirmDiscard() {
        return confirmDiscardRef.current();
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

    if (autosave) {
      pendingDraftRef.current = { id: draftId, json };
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(flushDraft, autosaveDelayMs);
    }
  };

  /** A draft was restored into the editor: that content is unsaved work. */
  const handleDraftRestored = (entry: DraftEntry) => {
    setIsDirty(true);
    if (documentId && entry.id === documentId) onDraftRestored?.({ documentId, savedAt: entry.draft.savedAt });
    // Without a documentId the restored draft becomes this editor's own, so
    // later edits update it instead of piling up copies.
    if (!documentId) setAdoptedDraftId(entry.id);
  };

  const handleSave = () => {
    if (!editorStateRef.current) return;
    const json = editorStateRef.current.toJSON();
    const format: FormatId = config.formats.plainText ? 'plain-text' : 'lexical-json';
    const content = defaultFormatRegistry.serialize(format, json);
    lastSavedJsonRef.current = JSON.stringify(json);
    setIsDirty(false);
    // A successful explicit save supersedes any in-progress/queued autosave
    // draft — don't let a stale one linger and falsely prompt to "restore"
    // older content next time this document is opened (§6.2).
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    pendingDraftRef.current = null;
    clearDraft(draftId);
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
          <Toolbar
            config={config}
            onSave={handleSave}
            isDirty={isDirty}
            showSave={showSave}
            fontOptions={fontOptions}
            direction={dir}
            locale={locale}
            drafts={
              autosave
                ? { currentId: draftId, maxBytes: autosaveMaxBytes, adoptOnRestore: !documentId, onRestored: handleDraftRestored }
                : undefined
            }
          />
          {documentId && (
            <DraftRestore
              draftId={documentId}
              mode={restoreDraft}
              initialJson={initialContentJsonRef.current}
              locale={locale}
              onRestored={handleDraftRestored}
            />
          )}
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
          {/* hasCellMerge disabled: cell merge/split is an explicitly
              flagged open risk (lexical-editor-spec.md §12 item 3) needing
              its own scope decision — every table stays a plain grid until
              that's resolved, rather than shipping a half-built merge UI. */}
          {config.tables && <TablePlugin hasCellMerge={false} hasTabHandler />}
          {config.blocks.horizontalRule && <HorizontalRulePlugin />}
          <OnChangePlugin onChange={handleChange} />
        </LexicalComposer>
        </ImageOptionsContext.Provider>
        <LeaveDialog
          opened={leavePrompt !== null}
          canSave={Boolean(onSave)}
          canSaveDraft={autosave || navigationGuard === 'save-draft'}
          draftFailed={leavePrompt?.draftFailed ?? false}
          onSave={() => {
            handleSave();
            settleLeave(true);
          }}
          onSaveDraft={() => {
            if (saveDraftNow()) settleLeave(true);
            else setLeavePrompt({ draftFailed: true });
          }}
          onDiscard={() => {
            // The user chose to drop this work, so no draft of it should linger either.
            if (autosaveTimerRef.current) {
              clearTimeout(autosaveTimerRef.current);
              autosaveTimerRef.current = null;
            }
            pendingDraftRef.current = null;
            clearDraft(draftId);
            settleLeave(true);
          }}
          onCancel={() => settleLeave(false)}
        />
        </UiStringsContext.Provider>
        </PortalTargetContext.Provider>
      </div>
    </EditorThemeProvider>
  );
});
