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
  react/            @inshapardaz/likhari-react — the editor component + toolbar
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

### PR previews

Every pull request from a branch in this repo gets its own copy of the demo at
`https://inshapardaz.github.io/likhari/pr-preview/pr-<number>/`, linked in a PR
comment and updated on each push. The preview is removed when the PR is merged
or closed. `main` deploys to the site root. Requires Pages set to
**Deploy from a branch: `gh-pages` / root** (one-time setting).

## Images

With `images.linked` / `images.embedded` enabled, the toolbar's image button opens
a dialog to insert an image **from a URL** (`http(s)`, relative, or a base64 image
data URI) or **upload a file** (PNG, JPEG, GIF, WebP or SVG, up to
`images.maxSizeMB`, default 5). `images.caption` gives the image an editable
caption under it. Click an image to select it, then press Delete or Backspace to
remove it.

Uploads are embedded in the document as base64 data URIs by default, which bloats
it. To store files yourself, pass `onImageUpload`; the image then references the
URL you return:

```tsx
<EditorRoot onImageUpload={async (file) => (await uploadToMyStorage(file)).url} />
```

Images serialize to Lexical JSON as an `image` node (`src`, `altText`, `caption`,
`linkType`, `width`, `height`) and export to plain text as their alt text.

## Theming and customization (Mantine, headless)

> **Status: planned.** Phase 1 uses Mantine internally with a default theme,
> but the headless/extension API below is the target design, not yet shipped.
> Full design and extension guide: [`docs/mantine-headless-theming.md`](docs/mantine-headless-theming.md).

The editor is built on [Mantine](https://mantine.dev) in **headless mode**: the
editor supplies structure, behavior, and accessibility; a **default theme**
supplies the looks, so it works out of the box and can be restyled without
fighting Mantine's own visuals.

### Setup

`@mantine/core` and `@mantine/hooks` are peer dependencies. Import the two
stylesheets once in your app's entry point. The editor renders its own
`MantineProvider`, so you do not need to wrap it.

```tsx
import '@mantine/core/styles.css';
import '@inshapardaz/likhari-react/styles.css';
import { EditorRoot } from '@inshapardaz/likhari-react';

<EditorRoot />   // default theme, no other configuration
```

### Customize, from least to most effort

| Goal | How |
|---|---|
| Change colors, radius, spacing | Set `--editor-*` CSS variables (works in React, Vue, and the Web Component) |
| Change Mantine defaults (fonts, primary color, component props) | `theme` prop, deep-merged over the default theme |
| Match an app that already uses Mantine | Omit `theme`; the editor inherits the host's nested `MantineProvider` |
| Restyle individual parts | `classNames` / `styles` props (Mantine Styles API) |
| Remove all default visuals, keep behavior | `unstyled` prop |
| Swap one control | `components={{ ToolbarButton: MyButton }}` |
| Build a completely custom toolbar | `toolbar` prop plus hooks (`useFormatState`, `useToolbarActions`, ...) |

```tsx
// Override the theme
<EditorRoot theme={{ primaryColor: 'violet' }} colorScheme="dark" />

// Headless: bring your own styles
<EditorRoot unstyled classNames={{ toolbar: 'my-toolbar', toolbarButton: 'my-btn' }} />
```

### Behavior worth knowing

Borrowed from the sibling EPUB reader [qari](https://github.com/inshapardaz/qari):

- CSS variables and Mantine portals are scoped to the editor root, so several
  editors with different themes can share a page, and menus and dialogs stay
  visible in fullscreen and inside a Web Component's shadow root.
- `colorScheme` is set on the editor (`light`, `dark`, `auto`) and is not
  inherited from your app's Mantine provider, so a host dark-mode toggle cannot
  desync the toolbar from the canvas.
- Use logical CSS properties (`padding-inline-start`, not `padding-left`) in
  overrides so they stay correct in RTL languages.
- Feature toggles in `EditorFeatureConfig` control which controls are
  available. They do not unregister document node types, even with a custom
  toolbar.
