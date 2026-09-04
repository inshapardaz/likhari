import { useRef, useState, type ReactNode } from 'react';
import { EditorRoot, type EditorRef } from '@likhari/editor-react';
import { resolveFeatureConfig, type EditorFeatureConfig, type FeatureConfigPresetName } from '@likhari/core';

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

function toEditorFeatureConfig(resolved: ReturnType<typeof resolveFeatureConfig>): EditorFeatureConfig {
  // ResolvedEditorFeatureConfig has every field populated, so it's already a
  // valid (fully-specified) EditorFeatureConfig — this just re-labels the type
  // for use as controlled component state.
  return JSON.parse(JSON.stringify(resolved)) as EditorFeatureConfig;
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset style={{ border: '1px solid #DAD7CE', borderRadius: 8, padding: '10px 12px', margin: 0 }}>
      <legend style={{ fontSize: 12, fontWeight: 600, color: '#5C5A54', padding: '0 4px' }}>{title}</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </fieldset>
  );
}

export function App() {
  const editorRef = useRef<EditorRef>(null);
  const [output, setOutput] = useState('');
  const [preset, setPreset] = useState<FeatureConfigPresetName>('standard');
  const [config, setConfig] = useState<EditorFeatureConfig>(() => toEditorFeatureConfig(resolveFeatureConfig(undefined, 'standard')));
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [showSave, setShowSave] = useState(true);

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

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: colorScheme === 'dark' ? '#111' : '#fff' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px', color: colorScheme === 'dark' ? '#EDEBE4' : '#1E1E1C' }}>
        <h1 style={{ marginBottom: 4 }}>Likhari — interactive demo</h1>
        <p style={{ color: '#5C5A54', marginTop: 0 }}>
          Toggle features below and watch the toolbar (and what it lets you do in the canvas) update live — this is the
          <code> EditorFeatureConfig</code> from <code>docs/lexical-editor-spec.md</code> §5 in action.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ControlGroup title="Preset">
              <select value={preset} onChange={(e) => applyPreset(e.target.value as FeatureConfigPresetName)} style={{ fontSize: 13 }}>
                <option value="minimal">minimal</option>
                <option value="standard">standard</option>
                <option value="full">full</option>
                <option value="poetry">poetry</option>
              </select>
              <span style={{ fontSize: 11, color: '#5C5A54' }}>Resets every toggle below to the preset's values.</span>
            </ControlGroup>

            <ControlGroup title="Formatting">
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

            <ControlGroup title="Lists & quote">
              <Checkbox label="Bullet list" checked={!!config.lists?.bullet} onChange={(v) => updateLists('bullet', v)} />
              <Checkbox label="Numbered list" checked={!!config.lists?.numbered} onChange={(v) => updateLists('numbered', v)} />
              <Checkbox label="Check list" checked={!!config.lists?.check} onChange={(v) => updateLists('check', v)} />
              <Checkbox label="Quote" checked={!!config.blocks?.quote} onChange={(v) => updateBlocks('quote', v)} />
            </ControlGroup>

            <ControlGroup title="Headings">
              {HEADING_LEVELS.map((level) => (
                <Checkbox
                  key={level}
                  label={`Heading ${level}`}
                  checked={!!config.blocks?.headingLevels?.includes(level)}
                  onChange={(v) => toggleHeadingLevel(level, v)}
                />
              ))}
            </ControlGroup>

            <ControlGroup title="Alignment & indent">
              <Checkbox label="Start" checked={!!config.alignment?.start} onChange={(v) => updateAlignment('start', v)} />
              <Checkbox label="Center" checked={!!config.alignment?.center} onChange={(v) => updateAlignment('center', v)} />
              <Checkbox label="Justify" checked={!!config.alignment?.justify} onChange={(v) => updateAlignment('justify', v)} />
              <Checkbox label="Left (literal)" checked={!!config.alignment?.left} onChange={(v) => updateAlignment('left', v)} />
              <Checkbox label="Right (literal)" checked={!!config.alignment?.right} onChange={(v) => updateAlignment('right', v)} />
              <Checkbox label="Indent / outdent" checked={!!config.indent} onChange={(v) => updateTopLevel('indent', v)} />
            </ControlGroup>

            <ControlGroup title="Other">
              <Checkbox label="Undo / redo" checked={!!config.history} onChange={(v) => updateTopLevel('history', v)} />
              <Checkbox label="Save button" checked={showSave} onChange={setShowSave} />
            </ControlGroup>

            <ControlGroup title="Theme">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={colorScheme === 'dark'}
                  onChange={(e) => setColorScheme(e.target.checked ? 'dark' : 'light')}
                />
                Dark mode
              </label>
            </ControlGroup>
          </div>

          <div>
            {/* This wrapper is given an explicit height so the editor below
                (height="100%") fits it exactly and scrolls internally once
                its content overflows, instead of growing and pushing the
                rest of the page down. */}
            <div style={{ height: '60vh' }}>
              <EditorRoot
                ref={editorRef}
                documentId="demo-doc"
                featureConfig={config}
                colorScheme={colorScheme}
                placeholder="Start writing…"
                height="100%"
                onSave={showSave ? (content, format) => setOutput(`[${format}]\n${content}`) : undefined}
              />
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button onClick={() => setOutput(editorRef.current?.getContent('plain-text') ?? '')}>Get plain text</button>
              <button onClick={() => setOutput(editorRef.current?.getContent('lexical-json') ?? '')}>Get Lexical JSON</button>
            </div>
            <pre
              style={{
                background: colorScheme === 'dark' ? '#242422' : '#f4f4f4',
                color: colorScheme === 'dark' ? '#EDEBE4' : '#1E1E1C',
                padding: 12,
                whiteSpace: 'pre-wrap',
                marginTop: 12,
                borderRadius: 6,
                minHeight: 24,
              }}
            >
              {output}
            </pre>

            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: '#5C5A54' }}>Current EditorFeatureConfig (JSON)</summary>
              <pre style={{ background: '#f4f4f4', padding: 12, fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6 }}>
                {JSON.stringify(config, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
