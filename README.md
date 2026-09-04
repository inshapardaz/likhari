# likhari

An Urdu-first multilingual rich text editor, built on [Lexical](https://lexical.dev/).
See `CLAUDE.md` and `docs/` for the full specification; this file covers the
implementation as it stands.

## Status: Phase 1

Per `docs/lexical-editor-spec.md` §13, Phase 1 covers: core React editor with
basic formatting, lists, headings, alignment/indent, undo/redo, plain-text +
Lexical JSON I/O, feature-flag config scaffolding, and the default Mantine
theme — English only. Later phases (Urdu/Punjabi + BiDi, Markdown/HTML,
columns/footnotes/poetry, language tooling, Vue/Web Component wrappers) are
not yet implemented; see the phasing table in the spec.

## Packages

```
packages/
  core/            EditorFeatureConfig schema + presets, design tokens/theme.css
  converters/       Format transformers (plain-text, Lexical JSON done;
                     Markdown/HTML are Phase 2 stubs behind the same interface)
  react/            @likhari/editor-react — the editor component + toolbar
apps/
  demo/             Vite app for manually exercising the editor
```

## Development

```bash
npm install
npm run dev      # demo app at the printed localhost URL
npm test         # vitest
npm run typecheck
```
