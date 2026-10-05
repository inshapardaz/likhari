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
                     Markdown draft dialect done)
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

## React props (`<EditorRoot>`)

Every prop is optional. Defaults are shown where they apply.

### Document and content

| Prop | Type | Default | Description |
|---|---|---|---|
| `documentId` | `string` | none | Names the document. Its drafts are stored under this id, and it is required for `restoreDraft` to find a draft. |
| `initialContent` | `EditorInitialContent` | empty | Content to load when the editor mounts. |
| `onChange` | `(state: SerializedEditorState) => void` | none | Called on every change, with the Lexical state. |
| `placeholder` | `string` | the locale's text | Shown while the canvas is empty. |
| `height` | `string \| number` | `'480px'` | Height of the toolbar and canvas together. The canvas scrolls inside it. Accepts any CSS length, such as `'100%'`, `'60vh'` or a number of pixels. |
| `locale` | `Locale` | `'en'` | UI language for labels, tooltips and menus. Also picks the default font and direction. |

### Features

| Prop | Type | Default | Description |
|---|---|---|---|
| `featurePreset` | `FeatureConfigPresetName` | `'full'` | Starting set of features: `minimal`, `standard`, `full` or `poetry`. |
| `featureConfig` | `EditorFeatureConfig` | from the preset | Turns individual features on or off. Overrides the preset. |
| `fontOptions` | `FontOption[]` | `DEFAULT_FONT_OPTIONS` | Entries in the font-family dropdown. Spread the defaults to add your own. |
| `punctuation` | `PunctuationOptions` | both on | Common punctuation fixes, and whether a straight `"` becomes `”`. |
| `urduNormalization` | `UrduNormalizationOptions` | built-in | Urdu normalisation applied during auto-correct. Set `removeDiacritics` to strip diacritics. |
| `autoCorrectStores` | `AutoCorrectStore[]` | built-in | Where auto-corrections are loaded from and saved to, in priority order. Pass a stable array. |
| `dictionaryStores` | `UserWordStore[]` | built-in | Where words added to the spelling dictionary are saved, in priority order. Pass a stable array. |
| `completionStores` | `CompletionStore[]` | dictionaries and user words | Where autocomplete words come from. Pass a stable array. |
| `autoCompleteLanguage` | `SpellLanguage \| 'auto'` | `'auto'` | Language for autocomplete. `'auto'` follows each block's direction: English for left-to-right, Urdu for right-to-left. |
| `thesaurusStores` | `ThesaurusStore[]` | English WordNet | Where synonyms come from, merged in order. Pass a stable array. |

### Images and saving

| Prop | Type | Default | Description |
|---|---|---|---|
| `onImageUpload` | `(file: File) => Promise<string>` | none | Stores an uploaded image and returns its URL. Without it, images are embedded as base64, which makes the document large. |
| `fetchImage` | `(url: string) => Promise<Blob>` | browser fetch | Downloads a linked image when it is embedded or edited. Use this to route through your backend when the image server sends no CORS headers. |
| `onSave` | `(content: string, format: FormatId) => void` | none | Called by the Save button with the serialized content. |
| `showSave` | `boolean` | `true` when `onSave` is set | Shows the Save button. Set it to show the button without a handler, or to hide it while keeping `onSave`. |

### Drafts and leaving

| Prop | Type | Default | Description |
|---|---|---|---|
| `autosave` | `boolean` | `true` | Saves drafts to `localStorage` while the user types. |
| `autosaveDelayMs` | `number` | `750` | How long to wait after typing before writing a draft, in milliseconds. |
| `autosaveMaxBytes` | `number` | `2_000_000` | Skips a draft larger than this, so one document cannot fill browser storage. |
| `autosaveMaxDrafts` | `number` | `20` | How many drafts to keep across all documents. The oldest are deleted first. |
| `restoreDraft` | `'prompt' \| 'auto' \| 'off'` | `'prompt'` | On mount, when a newer draft exists: ask the user, load it, or keep the initial content and move the draft aside. |
| `onDraftRestored` | `(draft: { documentId: string; savedAt: number }) => void` | none | Called when a draft is loaded into the editor. |
| `navigationGuard` | `'confirm' \| 'save-draft' \| 'off'` | `'confirm'` | What happens when the user leaves with unsaved changes: ask, save a draft silently, or do nothing. |

### Appearance

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `MantineThemeOverride` | editor theme | Overrides the Mantine theme, deep-merged over the default. |
| `colorScheme` | `'light' \| 'dark'` | none | Colour scheme for the editor. |
| `accentColor` | `string` | editor default | A CSS colour for the accent. Sets Mantine's primary colour and the toolbar and canvas accent. |
| `toolbarStyle` | `ToolbarStyle` | `{ bordered: true, variant: 'light' }` | `bordered` outlines the toolbar and its button groups. `variant` is `'light'`, which tints the active button, or `'filled'`, which fills it with the accent. |

## Content formats and `setContent`

`ref.getContent(format)` and `ref.setContent(value, format)` accept `'lexical-json'`,
`'plain-text'`, `'html'` and `'markdown'`, and `initialContent`
takes the same formats. `setContent` replaces the document; the new value becomes the
clean baseline (no unsaved changes, and any pending draft of the old content is dropped).

**HTML.** Export writes semantic HTML: paragraphs, headings, quotes, lists (including
nested and checklists), links, tables, images (`<figure>`/`<figcaption>`), rules and page
breaks, with `dir`, `text-align` and `padding-inline-start` for direction, alignment and
indent. Import accepts arbitrary HTML (pasted web pages, other tools' output): inline
formatting from tags or `style`, bare text is wrapped in paragraphs, `<script>`/`<style>`
are dropped, and `javascript:` links and non-image `data:` sources are removed. Import
needs a DOM (`DOMParser`), so it runs in the browser or jsdom, not plain Node.

**Markdown.** The extended dialect (GFM plus `remark-directive` constructs for underline,
sup/sub, colour/font, alignment, indent, direction, captions and page breaks) is written
up in [`docs/markdown-dialect.md`](docs/markdown-dialect.md), including what each
format round-trips and what degrades. Columns, footnotes and poetry join it with their
Phase 3 editor features.

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

### Toolbar appearance

`toolbarStyle` sets how the toolbar looks. The toolbar takes its colour from the
editor's `accentColor`.

```tsx
<EditorRoot
  accentColor="#2B6E6E"
  toolbarStyle={{ bordered: false, variant: 'filled' }}
/>
```

- `bordered` (default `true`): outlines the toolbar and each group of buttons.
  `false` removes the outlines and keeps the dividers between sections.
- `variant` (default `'light'`): `'light'` tints the active button; `'filled'`
  fills it with the accent colour.

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

## Browser compatibility

Supported in current stable releases of Chrome, Edge, Firefox and Safari.
Older browsers are not targeted.

| Feature | Requirement | If unsupported |
| --- | --- | --- |
| Centered poetry couplet (`:has()` selector) | Chrome 105+, Edge 105+, Safari 15.4+, Firefox 121+ | The couplet renders at full width instead of centered. Editing still works. |
| Logical CSS properties (`margin-inline`, `padding-inline-start`, ...) | Chrome 87+, Edge 87+, Safari 14.1+, Firefox 66+ | Spacing and alignment in RTL content may be wrong. |
| `text-align-last` (justified last line in poetry) | Chrome 47+, Edge 79+, Safari 16+, Firefox 49+ | Single-line poetry lines are not stretched. |
| CSS grid `gap` (columns and two-column poetry) | Chrome 66+, Edge 66+, Safari 12+, Firefox 61+ | Spacing between columns falls back to zero. |
| `ResizeObserver` (toolbar overflow) | Chrome 64+, Edge 79+, Safari 13.1+, Firefox 69+ | The toolbar does not collapse overflowing items. |

Not supported: Internet Explorer and other legacy browsers.

The HTML export writes its styles inline, so exported poetry keeps its
layout outside the editor. It only depends on the logical properties and
`text-align-last` listed above.

## Embedding the editor: Web Component and Vue

Two wrappers are provided for pages that do not use React. Both use the same
editor as the React component, so features and file formats are identical.

> **Status:** `@inshapardaz/likhari-webcomponent` and `@inshapardaz/likhari-vue`
> are not yet published to npm. Until they are, build them from this repository
> (`npm install && npm run build -w packages/webcomponent`, then `-w packages/vue`)
> and use the built `dist/` folders. Once published, install them with npm as
> shown below.

### Web Component (`<likhari-editor>`)

Works in any page, with no framework.

```html
<script type="module" src="/node_modules/@inshapardaz/likhari-webcomponent/dist/likhari-webcomponent.js"></script>

<likhari-editor feature-preset="full" locale="en" height="480px" show-save></likhari-editor>
```

The bundle is one module with React, the editor and Mantine included. It is
about 2.5MB (about 700KB gzipped). Load it once per page.

**Attributes**

| Attribute | Values | Default |
| --- | --- | --- |
| `feature-preset` | `minimal`, `standard`, `full`, `poetry` | `standard` |
| `locale` | `en`, `ur`, `pa-shahmukhi` | `en` |
| `color-scheme` | `light`, `dark` | `light` |
| `accent-color` | any CSS colour | the editor's accent |
| `height` | any CSS length | fills its container |
| `placeholder` | text | none |
| `document-id` | any string; enables autosave for that document | none |
| `show-save` | present (or `"true"`) to show; `"false"` to hide | hidden |
| `autosave` | `"false"` to turn off | on |

**Property**

Use the `featureConfig` property for fine-grained feature control. It is nested,
so it cannot be an attribute:

```js
const editor = document.querySelector('likhari-editor');
editor.featureConfig = { ...someConfig };
```

**Events**

Both events bubble and cross shadow boundaries.

```js
editor.addEventListener('editor-change', (event) => {
  // event.detail: the editor's state
});

editor.addEventListener('editor-save', (event) => {
  // event.detail: { content: string, format: 'markdown' | 'html' | 'plain-text' | 'lexical-json' }
});
```

**Methods**

```js
editor.getContent('html');          // or 'markdown', 'plain-text', 'lexical-json'
editor.setContent('# Hello', 'markdown');
editor.hasUnsavedChanges();         // true when there are edits not yet saved
await editor.confirmDiscard();      // resolves false if the user chose to stay
editor.focus();
```

**Installation with npm (once published)**

```sh
npm install @inshapardaz/likhari-webcomponent
```

Then import it once in your entry file: `import '@inshapardaz/likhari-webcomponent';`

**Spellcheck dictionaries**

The English dictionary is copied into `dist/dictionaries/en/` beside the bundle
and loaded from there. Serve that folder with the bundle. If you host the bundle
somewhere else, point the editor at your copy from your own code:

```js
import { setEnglishDictionaryBaseUrl } from '@inshapardaz/likhari-react';
setEnglishDictionaryBaseUrl('https://example.com/likhari/dictionaries/en/');
```

**Styles and Shadow DOM**

The element renders into the page, not a shadow root, because the editor's
menus and dialogs are attached to the document. Its styles are added to the page
head once, so your page's own CSS can affect the editor. Keep the editor's
class names (they start with `likhari-`) from being restyled by global rules.

### Vue 3 (`<LikhariEditor>`)

A component over the Web Component. Vue 3.5 or later is required.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { LikhariEditor } from '@inshapardaz/likhari-vue';

const editor = ref<InstanceType<typeof LikhariEditor> | null>(null);
const config = { /* EditorFeatureConfig */ };

function onSave({ content, format }: { content: string; format: string }) {
  // send content to your server
}
</script>

<template>
  <LikhariEditor
    ref="editor"
    feature-preset="full"
    locale="ur"
    height="480px"
    :show-save="true"
    :feature-config="config"
    @change="(state) => console.log(state)"
    @save="onSave"
  />
  <button @click="editor?.getContent('markdown')">Export Markdown</button>
</template>
```

Props match the Web Component's attributes, in camelCase: `documentId`, `locale`,
`colorScheme`, `accentColor`, `placeholder`, `height`, `showSave`, `autosave`,
`featurePreset`, and `featureConfig` (an object). Boolean props left unset use the
editor's default; they are not sent as `false`.

Template ref methods: `getContent(format)`, `setContent(value, format)`,
`hasUnsavedChanges()`, `confirmDiscard()`, `focus()`.

**Installation with npm (once published)**

```sh
npm install @inshapardaz/likhari-vue @inshapardaz/likhari-webcomponent vue
```

The Vue package loads the Web Component from its own dependency, so both must be
installed. Keep the `dictionaries/` folder that the Web Component copies next to
its bundle served with your app (see the Web Component section).

### Browser support

Both wrappers follow the editor's [browser compatibility](#browser-compatibility)
requirements.
