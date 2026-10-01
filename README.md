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
  converters/       Format transformers (plain-text, Lexical JSON, HTML done;
                     Markdown is still a stub behind the same interface)
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

## Content formats and `setContent`

`ref.getContent(format)` and `ref.setContent(value, format)` accept `'lexical-json'`,
`'plain-text'` and `'html'` (`'markdown'` is not implemented yet), and `initialContent`
takes the same formats. `setContent` replaces the document; the new value becomes the
clean baseline (no unsaved changes, and any pending draft of the old content is dropped).

**HTML.** Export writes semantic HTML: paragraphs, headings, quotes, lists (including
nested and checklists), links, tables, images (`<figure>`/`<figcaption>`), rules and page
breaks, with `dir`, `text-align` and `padding-inline-start` for direction, alignment and
indent. Import accepts arbitrary HTML (pasted web pages, other tools' output): inline
formatting from tags or `style`, bare text is wrapped in paragraphs, `<script>`/`<style>`
are dropped, and `javascript:` links and non-image `data:` sources are removed. Import
needs a DOM (`DOMParser`), so it runs in the browser or jsdom, not plain Node.

## Images

With `images.linked` / `images.embedded` enabled, the toolbar's image button opens
a dialog to insert an image **from a URL** (`http(s)`, relative, or a base64 image
data URI) or **upload a file** (PNG, JPEG, GIF, WebP or SVG, up to
`images.maxSizeMB`, default 5), with alt text and, if `images.caption` is on, an
optional caption. An image has no caption until you give it one.

Working with an image in the document:

- **Click** to select it; Delete or Backspace removes it.
- **Right-click** for a menu: *Edit image…*, *Convert to embedded image…* (linked
  images), *Add caption…* / *Edit caption…*, *Remove caption*, *Delete image*.
  **Double-click** opens *Edit image…* directly.
- **Edit image** has two tabs. *Details*: replace the image with a new URL or
  upload, alt text, caption, and converting a linked image to an embedded one.
  *Crop & size*: rotate, flip, crop, and set the size, all in one place. Drag on
  the preview to draw a crop area (free, 1:1, 4:3 or 16:9), then drag its handles
  to resize it or drag inside it to move it, and *Apply crop*. Below that, set the
  width and height (proportions lockable, 25/50/75/100% presets, back to original).
  *Undo edits* reverts the pixel changes.
- **Drag the corner handle** of a selected embedded image to resize it
  (proportions kept).

**Only embedded images can be edited.** Cropping, rotating and resizing change the
image's own pixels (or size), which a linked image doesn't have in the document. A
linked image's *Crop & size* tab offers **Convert to embedded image**, which
downloads a copy into the document (it needs the image's server to allow
cross-origin downloads; otherwise the dialog says so and suggests uploading the
file). When inserting from a URL you can tick *Embed a copy in the document* to do
the same up front. Edited and converted pixels are embedded as a base64 data URI
(GIF and SVG become PNG when edited), or stored through `onImageUpload` when you
provide one.

Uploads are embedded as base64 data URIs by default, which bloats the document. To
store files yourself, pass `onImageUpload`; the image then references the URL you
return:

```tsx
<EditorRoot onImageUpload={async (file) => (await uploadToMyStorage(file)).url} />
```

Images serialize to Lexical JSON as an `image` node (`src`, `altText`, `caption`,
`linkType`, `width`, `height`) and export to plain text as their alt text.

## Tables

With `tables` enabled in the feature config, the toolbar's table button inserts a
table (rows, columns, optional header row). Cells can't be merged or split yet (see
the open risk in `docs/lexical-editor-spec.md` §12), so every table is a plain grid.

**Table actions.** While the caret is in a table the toolbar shows a *Table options*
button, and right-clicking a cell opens the same menu at the pointer:

- *Insert row before / after*, *Insert column before / after*
- *Delete row*, *Delete column*, *Delete table*

Select several cells (drag across them) and the actions apply to the whole selection:
the menu switches to *Insert rows / columns before / after* and inserts as many as are
selected, on the outside edge of the selection; *Delete rows / columns* removes every
row or column the selection touches. In a right-to-left table "before" is the right-hand
side. Deleting the last remaining row or column removes the table.

## Fonts

When `font.family` / `font.size` are enabled in the feature config, the toolbar
has a searchable font-family dropdown and a size dropdown (12–48 px). They set
an inline `font-family` / `font-size` style on text, following
`font.scope`: `'selection'` styles the selected text, `'document'` styles every
text node, and `'both'` (the full preset's default) styles the selection, or the
whole document when nothing is selected.

The family list is three generic Latin faces plus the Urdu/Arabic-script
collection from [inshapardaz/urdu-web-fonts](https://github.com/inshapardaz/urdu-web-fonts)
(Noto Nastaliq Urdu, Jameel Noori Nastaleeq, Amiri, Lateef, Scheherazade New and
20+ more) — the same source and pinned commit that
[qari](https://github.com/inshapardaz/qari) uses. Their stylesheets load from
jsDelivr's GitHub CDN (no npm dependency, nothing bundled); a font file is only
downloaded once it is used. To change the list, pass `fontOptions`:

```tsx
import { EditorRoot, DEFAULT_FONT_OPTIONS } from '@inshapardaz/likhari-react';

<EditorRoot
  fontOptions={[...DEFAULT_FONT_OPTIONS, { name: 'My font', family: '"My font", serif', group: 'Custom' }]}
/>
```

## Drafts and leaving with unsaved changes

Three props control how unsaved work is protected. The defaults are shown.

| Prop | Values | What it controls |
|---|---|---|
| `autosave` | `true` / `false` | **Save drafts.** While you type, a draft is saved to the browser's `localStorage` (debounced by `autosaveDelayMs`, default 750 ms). A successful save clears it. |
| `restoreDraft` | `'prompt'` / `'auto'` / `'off'` | **Load a saved draft** of this `documentId` that is newer than the initial content, on mount. `'prompt'` shows a banner (Restore / Ignore / Remove draft); `'auto'` loads it straight away (see `onDraftRestored`); `'off'` keeps the initial content and moves the draft aside into the drafts list. |
| `navigationGuard` | `'confirm'` / `'save-draft'` / `'off'` | **What happens when the user leaves with unsaved changes.** `'confirm'` asks (an in-editor popup through `confirmDiscard()`); `'save-draft'` silently saves a draft and lets them go; `'off'` never asks. |

```tsx
// Silently keep a draft and never interrupt the user
<EditorRoot documentId="chapter-3" restoreDraft="auto" navigationGuard="save-draft" />

// Never store anything in the browser, but still ask before leaving
<EditorRoot autosave={false} restoreDraft="off" navigationGuard="confirm" />
```

**Leaving.** In-app navigation is yours to intercept (the editor can't know your
router), so call `await ref.current.confirmDiscard()` from your route guard: it
resolves `true` if leaving is fine and `false` if the user cancelled. With
`navigationGuard="confirm"` it opens an in-editor popup with one row of buttons,
**Save** (when you pass `onSave`), **Discard**, **Save draft** and **Cancel**, instead
of the browser's `window.confirm()`. Escape, the close button and clicking outside
all mean Cancel. With `'save-draft'` it saves a draft and resolves `true` with no
popup (this works even when `autosave` is `false`). If a draft can't be stored, for
example because the document is over `autosaveMaxBytes`, it falls back to the popup,
so work is never lost silently. `hasUnsavedChanges()` tells you whether there is
anything to ask about.

**Closing or refreshing the tab.** A page can't show its own popup there, and the
browser's "leave this page?" prompt can't be restyled or reworded. So the editor
avoids it: with `autosave` on (or `navigationGuard="save-draft"`) it saves a draft as
the page unloads and shows nothing. The work comes back through the restore banner or
the drafts list when the page is opened again. The browser prompt only appears as a
last resort, with `navigationGuard="confirm"` when no draft could be stored (autosave
is off, the document is over `autosaveMaxBytes`, or storage is unavailable), because
it is then the only thing between the user and losing their work. Set
`navigationGuard="off"` to never show it.

**Draft key.** The draft is stored under your `documentId` when you give one. Without
one, the editor generates a unique id for itself, so editors without a `documentId`
never overwrite each other's drafts (`restoreDraft` needs a `documentId`, since there
is no stable key to look up).

**Drafts list.** The toolbar's clock button lists every draft in the browser (all
documents, plus the earlier versions kept by *Ignore*, `restoreDraft="off"` and
restores), newest first, with **Restore** and **Delete**. Restoring over different
content asks first, and keeps the content it replaces as a draft of its own. Without
a `documentId`, a restored draft becomes this editor's draft, so later edits update it.

**Limits.** A draft over `autosaveMaxBytes` (default ~2 MB, since embedded images make
documents large) isn't written, a blank document isn't stored, and only the newest
`autosaveMaxDrafts` (default 20) are kept. Drafts live in this browser only.

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
