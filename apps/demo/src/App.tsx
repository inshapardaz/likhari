import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ColorInput, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { EditorRoot, registerSpellDictionary, type DraftRestoreMode, type EditorRef, type NavigationGuardMode, setEnglishDictionaryBaseUrl } from '@inshapardaz/likhari-react';
import { resolveFeatureConfig, type EditorFeatureConfig, type FeatureConfigPresetName } from '@inshapardaz/likhari-core';

// The English dictionary is copied into public/dictionaries/en at build time (see package.json).
setEnglishDictionaryBaseUrl(`${import.meta.env.BASE_URL}dictionaries/en/`);

// Urdu spelling list built from the headwords of the reader demo's فرہنگ آصفیہ
// dictionary (demo/public/dictionaries/ur-spell). Loaded on first use only.
// Inflected forms are not in it, so some correct words will be flagged.
registerSpellDictionary('ur', async () => {
  const base = `${import.meta.env.BASE_URL}dictionaries/ur-spell/`;
  const [aff, dic] = await Promise.all([
    fetch(`${base}index.aff`).then((r) => r.text()),
    fetch(`${base}index.dic`).then((r) => r.text()),
  ]);
  return { aff, dic };
});

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

type Locale = 'en' | 'ur' | 'pa-shahmukhi';

const LOCALE_DIR: Record<Locale, 'ltr' | 'rtl'> = { en: 'ltr', ur: 'rtl', 'pa-shahmukhi': 'rtl' };

/** Each language's own name, in its own script — shown in the dropdown
 * regardless of which locale is currently selected. */
const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  ur: 'اردو',
  'pa-shahmukhi': 'پنجابی (شاہ مکھی)',
};

/** UI strings for the demo's own chrome, localised to match the selected
 * language — separate from the editor's own (already-localised) toolbar. */
const STRINGS: Record<
  Locale,
  { title: string; language: string; darkMode: string; collapse: string; expand: string; accentColor: string }
> = {
  en: {
    title: 'Likhari demo',
    language: 'Language',
    darkMode: 'Dark mode',
    collapse: 'Collapse options',
    expand: 'Expand options',
    accentColor: 'Accent color',
  },
  ur: {
    title: 'لکھاری ڈیمو',
    language: 'زبان',
    darkMode: 'ڈارک موڈ',
    collapse: 'اختیارات چھپائیں',
    expand: 'اختیارات دکھائیں',
    accentColor: 'نمایاں رنگ',
  },
  'pa-shahmukhi': {
    title: 'لکھاری ڈیمو',
    language: 'زبان',
    darkMode: 'ڈارک موڈ',
    collapse: 'اختیاراں لکو',
    expand: 'اختیاراں وکھاؤ',
    accentColor: 'نمایاں رنگ',
  },
};

/** Matches packages/core/src/theme/tokens.ts LIGHT_TOKENS.accent — the
 * editor's built-in default, used as this control's initial value. */
const DEFAULT_ACCENT_COLOR = '#2B6E6E';
const ACCENT_SWATCHES = ['#2B6E6E', '#6741D9', '#E8590C', '#C2255C', '#2F9E44', '#1971C2', '#F08C00', '#495057'];

const VALID_LOCALES: Locale[] = ['en', 'ur', 'pa-shahmukhi'];
const VALID_PRESETS: FeatureConfigPresetName[] = ['minimal', 'standard', 'full', 'poetry'];

/** Persists the demo's own chrome preferences (not editor content) across
 * reloads — a convenience for trying the demo, not a feature of the editor
 * itself, so it lives here rather than in packages/react. */
const PREFS_KEY = 'likhari-demo-prefs';

interface DemoPrefs {
  locale: Locale;
  colorScheme: 'light' | 'dark';
  accentColor: string;
  preset: FeatureConfigPresetName;
}

function loadPrefs(): Partial<DemoPrefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<DemoPrefs>;
    return {
      locale: VALID_LOCALES.includes(parsed.locale as Locale) ? parsed.locale : undefined,
      colorScheme: parsed.colorScheme === 'dark' || parsed.colorScheme === 'light' ? parsed.colorScheme : undefined,
      accentColor: typeof parsed.accentColor === 'string' ? parsed.accentColor : undefined,
      preset: VALID_PRESETS.includes(parsed.preset as FeatureConfigPresetName) ? parsed.preset : undefined,
    };
  } catch {
    return {};
  }
}

function toEditorFeatureConfig(resolved: ReturnType<typeof resolveFeatureConfig>): EditorFeatureConfig {
  // ResolvedEditorFeatureConfig has every field populated, so it's already a
  // valid (fully-specified) EditorFeatureConfig — this just re-labels the type
  // for use as controlled component state.
  return JSON.parse(JSON.stringify(resolved)) as EditorFeatureConfig;
}

/** Pretty-prints a Lexical JSON (or any JSON) string; returns it unchanged if
 * it doesn't parse, so plain-text/markdown output isn't mangled. */
function formatIfJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ControlGroup({ title, children, dark }: { title: string; children: ReactNode; dark: boolean }) {
  return (
    <fieldset
      style={{
        border: `1px solid ${dark ? '#3A3934' : '#DAD7CE'}`,
        borderRadius: 8,
        padding: '10px 12px',
        margin: 0,
      }}
    >
      <legend style={{ fontSize: 12, fontWeight: 600, color: dark ? '#A9A69C' : '#5C5A54', padding: '0 4px' }}>{title}</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </fieldset>
  );
}

/** Shows a piece of output (saved content, an export, the feature config) as
 * a modal, so the editor keeps the rest of the screen instead of competing
 * with an ever-growing output panel below it. */
function OutputPopup({ title, content, dark, onClose }: { title: string; content: string; dark: boolean; onClose: () => void }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: dark ? '#1A1A18' : '#fff',
          color: dark ? '#EDEBE4' : '#1E1E1C',
          borderRadius: 8,
          width: 'min(900px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: `1px solid ${dark ? '#3A3934' : '#DAD7CE'}`,
            flex: '0 0 auto',
          }}
        >
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 16,
            overflow: 'auto',
            fontSize: 12,
            fontFamily: "ui-monospace, 'SFMono-Regular', Consolas, monospace",
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}

export function App() {
  const editorRef = useRef<EditorRef>(null);
  const [savedPrefs] = useState(loadPrefs);
  const [preset, setPreset] = useState<FeatureConfigPresetName>(savedPrefs.preset ?? 'standard');
  const [config, setConfig] = useState<EditorFeatureConfig>(() => toEditorFeatureConfig(resolveFeatureConfig(undefined, savedPrefs.preset ?? 'standard')));
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(savedPrefs.colorScheme ?? 'light');
  const [accentColor, setAccentColor] = useState(savedPrefs.accentColor ?? DEFAULT_ACCENT_COLOR);
  const [toolbarBordered, setToolbarBordered] = useState(true);
  const [toolbarVariant, setToolbarVariant] = useState<'light' | 'filled'>('light');
  const [toolbarOverflow, setToolbarOverflow] = useState(true);
  const [showSave, setShowSave] = useState(true);
  // Without a documentId the editor generates a unique draft id (see `autosave`).
  const [useDocumentId, setUseDocumentId] = useState(true);
  // The three draft / navigation behaviours (see EditorRootProps).
  const [autosave, setAutosave] = useState(true);
  const [restoreDraft, setRestoreDraft] = useState<DraftRestoreMode>('prompt');
  const [navigationGuard, setNavigationGuard] = useState<NavigationGuardMode>('confirm');
  const [locale, setLocale] = useState<Locale>(savedPrefs.locale ?? 'en');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [popup, setPopup] = useState<{ title: string; content: string } | null>(null);

  const dark = colorScheme === 'dark';
  const t = STRINGS[locale];
  const headerDir = LOCALE_DIR[locale];

  useEffect(() => {
    try {
      const prefs: DemoPrefs = { locale, colorScheme, accentColor, preset };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Private browsing / storage disabled: preferences just won't persist.
    }
  }, [locale, colorScheme, accentColor, preset]);

  const applyPreset = (name: FeatureConfigPresetName) => {
    setPreset(name);
    setConfig(toEditorFeatureConfig(resolveFeatureConfig(undefined, name)));
  };

  const updateFormatting = (key: keyof NonNullable<EditorFeatureConfig['formatting']>, value: boolean) =>
    setConfig((c) => ({ ...c, formatting: { ...c.formatting, [key]: value } }));

  const updateLists = (key: keyof NonNullable<EditorFeatureConfig['lists']>, value: boolean) =>
    setConfig((c) => ({ ...c, lists: { ...c.lists, [key]: value } }));

  const updateAlignment = (key: keyof NonNullable<EditorFeatureConfig['alignment']>, value: boolean) =>
    setConfig((c) => ({ ...c, alignment: { ...c.alignment, [key]: value } }));

  const toggleHeadingLevel = (level: (typeof HEADING_LEVELS)[number], value: boolean) =>
    setConfig((c) => {
      const current = c.blocks?.headingLevels ?? [];
      const next = value ? [...current, level].sort() : current.filter((l) => l !== level);
      return { ...c, blocks: { ...c.blocks, headingLevels: next } };
    });

  const updateBlocks = (key: 'quote' | 'horizontalRule' | 'pageBreak', value: boolean) =>
    setConfig((c) => ({ ...c, blocks: { ...c.blocks, [key]: value } }));

  const updateTopLevel = (key: 'indent' | 'history', value: boolean) => setConfig((c) => ({ ...c, [key]: value }));

  const showOutput = (title: string, content: string) => setPopup({ title, content });

  const borderColor = dark ? '#3A3934' : '#DAD7CE';

  return (
    // Separate from EditorRoot's own internal (per-instance-scoped)
    // MantineProvider — this one is only for the demo chrome's own Mantine
    // controls (the accent-color picker), forced to the same scheme as the
    // rest of the page so its popover matches light/dark mode too.
    <MantineProvider forceColorScheme={colorScheme}>
      <div
        style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          background: dark ? '#111' : '#fff',
          color: dark ? '#EDEBE4' : '#1E1E1C',
          height: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
      <header
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 16px',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? t.collapse : t.expand}
            aria-label={sidebarOpen ? t.collapse : t.expand}
            style={{
              border: `1px solid ${borderColor}`,
              background: 'transparent',
              color: 'inherit',
              borderRadius: 6,
              width: 28,
              height: 28,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {sidebarOpen ? '⟨' : '⟩'}
          </button>
          <h1 dir={headerDir} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {t.title}
          </h1>
        </div>

        <div dir={headerDir} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            {t.language}
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} style={{ fontSize: 12 }}>
              {(Object.keys(LANGUAGE_NAMES) as Locale[]).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={dark} onChange={(e) => setColorScheme(e.target.checked ? 'dark' : 'light')} />
            {t.darkMode}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={toolbarBordered} onChange={(e) => setToolbarBordered(e.target.checked)} />
            Bordered toolbar
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Toolbar variant
            <select value={toolbarVariant} onChange={(e) => setToolbarVariant(e.target.value as 'light' | 'filled')} style={{ fontSize: 12 }}>
              <option value="light">Light</option>
              <option value="filled">Filled</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={toolbarOverflow} onChange={(e) => setToolbarOverflow(e.target.checked)} />
            Toolbar overflow menu
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            {t.accentColor}
            <ColorInput
              size="xs"
              value={accentColor}
              onChange={setAccentColor}
              format="hex"
              swatches={ACCENT_SWATCHES}
              popoverProps={{ withinPortal: true }}
              styles={{ input: { width: 110 } }}
            />
          </label>
        </div>
      </header>

      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        {sidebarOpen && (
          <aside
            style={{
              flex: '0 0 260px',
              width: 260,
              overflowY: 'auto',
              padding: 16,
              borderRight: `1px solid ${borderColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <ControlGroup title="Preset" dark={dark}>
              <select
                aria-label="Preset"
                value={preset}
                onChange={(e) => applyPreset(e.target.value as FeatureConfigPresetName)}
                style={{ fontSize: 13 }}
              >
                <option value="minimal">minimal</option>
                <option value="standard">standard</option>
                <option value="full">full</option>
                <option value="poetry">poetry</option>
              </select>
              <span style={{ fontSize: 11, color: dark ? '#A9A69C' : '#5C5A54' }}>Resets every toggle below to the preset's values.</span>
            </ControlGroup>

            <ControlGroup title="Formatting" dark={dark}>
              <Checkbox label="Bold" checked={!!config.formatting?.bold} onChange={(v) => updateFormatting('bold', v)} />
              <Checkbox label="Italic" checked={!!config.formatting?.italic} onChange={(v) => updateFormatting('italic', v)} />
              <Checkbox label="Underline" checked={!!config.formatting?.underline} onChange={(v) => updateFormatting('underline', v)} />
              <Checkbox
                label="Strikethrough"
                checked={!!config.formatting?.strikethrough}
                onChange={(v) => updateFormatting('strikethrough', v)}
              />
              <Checkbox
                label="Superscript"
                checked={!!config.formatting?.superscript}
                onChange={(v) => updateFormatting('superscript', v)}
              />
              <Checkbox label="Subscript" checked={!!config.formatting?.subscript} onChange={(v) => updateFormatting('subscript', v)} />
              <Checkbox
                label="Case transforms (Aa)"
                checked={!!config.formatting?.caseTransforms}
                onChange={(v) => updateFormatting('caseTransforms', v)}
              />
              <Checkbox
                label="Clear formatting"
                checked={!!config.formatting?.clearFormatting}
                onChange={(v) => updateFormatting('clearFormatting', v)}
              />
            </ControlGroup>

            <ControlGroup title="Lists & quote" dark={dark}>
              <Checkbox label="Bullet list" checked={!!config.lists?.bullet} onChange={(v) => updateLists('bullet', v)} />
              <Checkbox label="Numbered list" checked={!!config.lists?.numbered} onChange={(v) => updateLists('numbered', v)} />
              <Checkbox label="Check list" checked={!!config.lists?.check} onChange={(v) => updateLists('check', v)} />
              <Checkbox label="Quote" checked={!!config.blocks?.quote} onChange={(v) => updateBlocks('quote', v)} />
              <Checkbox label="Page break" checked={!!config.blocks?.pageBreak} onChange={(v) => updateBlocks('pageBreak', v)} />
              <Checkbox label="Table" checked={!!config.tables} onChange={(v) => setConfig((c) => ({ ...c, tables: v }))} />
              <Checkbox label="Columns" checked={!!config.columns} onChange={(v) => setConfig((c) => ({ ...c, columns: v }))} />
              <Checkbox label="Footnotes" checked={!!config.footnotes} onChange={(v) => setConfig((c) => ({ ...c, footnotes: v }))} />
            </ControlGroup>

            <ControlGroup title="Headings" dark={dark}>
              {HEADING_LEVELS.map((level) => (
                <Checkbox
                  key={level}
                  label={`Heading ${level}`}
                  checked={!!config.blocks?.headingLevels?.includes(level)}
                  onChange={(v) => toggleHeadingLevel(level, v)}
                />
              ))}
            </ControlGroup>

            <ControlGroup title="Alignment & indent" dark={dark}>
              <Checkbox label="Start" checked={!!config.alignment?.start} onChange={(v) => updateAlignment('start', v)} />
              <Checkbox label="Center" checked={!!config.alignment?.center} onChange={(v) => updateAlignment('center', v)} />
              <Checkbox label="Justify" checked={!!config.alignment?.justify} onChange={(v) => updateAlignment('justify', v)} />
              <Checkbox label="Left (literal)" checked={!!config.alignment?.left} onChange={(v) => updateAlignment('left', v)} />
              <Checkbox label="Right (literal)" checked={!!config.alignment?.right} onChange={(v) => updateAlignment('right', v)} />
              <Checkbox label="Indent / outdent" checked={!!config.indent} onChange={(v) => updateTopLevel('indent', v)} />
            </ControlGroup>

            <ControlGroup title="Other" dark={dark}>
              <Checkbox label="Undo / redo" checked={!!config.history} onChange={(v) => updateTopLevel('history', v)} />
              <Checkbox label="Save button" checked={showSave} onChange={setShowSave} />
              <Checkbox label="Give the editor a documentId" checked={useDocumentId} onChange={setUseDocumentId} />
            </ControlGroup>

            <ControlGroup title="Drafts & leaving" dark={dark}>
              <Checkbox label="Save drafts (autosave)" checked={autosave} onChange={setAutosave} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                Load a saved draft
                <select value={restoreDraft} onChange={(e) => setRestoreDraft(e.target.value as DraftRestoreMode)} style={{ fontSize: 13 }}>
                  <option value="prompt">Ask (banner)</option>
                  <option value="auto">Automatically</option>
                  <option value="off">Never</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                When leaving unsaved
                <select
                  value={navigationGuard}
                  onChange={(e) => setNavigationGuard(e.target.value as NavigationGuardMode)}
                  style={{ fontSize: 13 }}
                >
                  <option value="confirm">Ask (popup)</option>
                  <option value="save-draft">Save a draft silently</option>
                  <option value="off">Don't ask</option>
                </select>
              </label>
              <button
                style={{ fontSize: 12 }}
                onClick={async () => {
                  const canLeave = (await editorRef.current?.confirmDiscard()) ?? true;
                  showOutput('confirmDiscard()', canLeave ? 'true: it is fine to leave' : 'false: stay on the page');
                }}
              >
                Simulate leaving the page
              </button>
            </ControlGroup>
          </aside>
        )}

        <main style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0, padding: 16, gap: 12 }}>
          <div style={{ flex: '1 1 auto', minHeight: 0 }}>
            <EditorRoot
              key={`${useDocumentId ? 'named' : 'anonymous'}-${restoreDraft}`}
              ref={editorRef}
              documentId={useDocumentId ? 'demo-doc' : undefined}
              autosave={autosave}
              restoreDraft={restoreDraft}
              navigationGuard={navigationGuard}
              featureConfig={config}
              colorScheme={colorScheme}
              accentColor={accentColor}
              toolbarStyle={{ bordered: toolbarBordered, variant: toolbarVariant, overflow: toolbarOverflow }}
              locale={locale}
              placeholder="Start writing…"
              height="100%"
              showSave={showSave}
              onSave={(content, format) => showOutput(`Saved (${format})`, format === 'lexical-json' ? formatIfJson(content) : content)}
            />
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => showOutput('Plain text', editorRef.current?.getContent('plain-text') ?? '')}>Get plain text</button>
            <button onClick={() => showOutput('HTML', editorRef.current?.getContent('html') ?? '')}>Get HTML</button>
            <button
              onClick={() =>
                editorRef.current?.setContent(
                  '<h1>Imported from HTML</h1><p>Plain, <strong>bold</strong>, <em>italic</em> and a <a href="https://example.com">link</a>.</p><p dir="rtl" style="text-align: start">یہ اردو کا ایک پیراگراف ہے۔</p><ul><li>One</li><li>Two</li></ul>',
                  'html',
                )
              }
            >
              Load HTML sample
            </button>
            <button
              onClick={() =>
                editorRef.current?.setContent(
                  '# Imported from Markdown\n\nPlain, **bold**, *italic*, :u[underlined] and a [link](https://example.com).\n\n:::para{align="center"}\nسلام دنیا\n:::\n\n- [x] done\n- [ ] todo\n\n| A | B |\n| - | - |\n| 1 | 2 |\n',
                  'markdown',
                )
              }
            >
              Load Markdown sample
            </button>
            <button onClick={() => showOutput('Markdown', editorRef.current?.getContent('markdown') ?? '')}>Get Markdown</button>
            <button onClick={() => showOutput('Lexical JSON', formatIfJson(editorRef.current?.getContent('lexical-json') ?? ''))}>
              Get Lexical JSON
            </button>
            <button onClick={() => showOutput('EditorFeatureConfig (JSON)', JSON.stringify(config, null, 2))}>Feature config</button>
          </div>
        </main>
      </div>

      {popup && <OutputPopup title={popup.title} content={popup.content} dark={dark} onClose={() => setPopup(null)} />}
      </div>
    </MantineProvider>
  );
}
