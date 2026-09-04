import { useRef, useState } from 'react';
import { EditorRoot, type EditorRef } from '@likhari/editor-react';

export function App() {
  const editorRef = useRef<EditorRef>(null);
  const [output, setOutput] = useState('');
  const [preset, setPreset] = useState<'minimal' | 'standard' | 'full'>('standard');

  return (
    <div style={{ maxWidth: 820, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Likhari — Phase 1 demo</h1>
      <p>
        Preset:{' '}
        <select value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
          <option value="minimal">minimal</option>
          <option value="standard">standard</option>
          <option value="full">full</option>
        </select>
      </p>
      <EditorRoot
        key={preset}
        ref={editorRef}
        documentId="demo-doc"
        featurePreset={preset}
        placeholder="Start writing…"
        onSave={(content, format) => setOutput(`[${format}]\n${content}`)}
      />
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setOutput(editorRef.current?.getContent('plain-text') ?? '')}>Get plain text</button>{' '}
        <button onClick={() => setOutput(editorRef.current?.getContent('lexical-json') ?? '')}>Get Lexical JSON</button>
      </div>
      <pre style={{ background: '#f4f4f4', padding: 12, whiteSpace: 'pre-wrap', marginTop: 16 }}>{output}</pre>
    </div>
  );
}
