# likhari

[![npm: @inshapardaz/likhari-react](https://img.shields.io/npm/v/%40inshapardaz%2Flikhari-react?label=%40inshapardaz%2Flikhari-react)](https://www.npmjs.com/package/@inshapardaz/likhari-react)
[![npm: @inshapardaz/likhari-core](https://img.shields.io/npm/v/%40inshapardaz%2Flikhari-core?label=%40inshapardaz%2Flikhari-core)](https://www.npmjs.com/package/@inshapardaz/likhari-core)
[![npm: @inshapardaz/likhari-converters](https://img.shields.io/npm/v/%40inshapardaz%2Flikhari-converters?label=%40inshapardaz%2Flikhari-converters)](https://www.npmjs.com/package/@inshapardaz/likhari-converters)

An Urdu-first multilingual rich text editor, built on [Lexical](https://lexical.dev/).

This file has two parts: [Working on this project](#working-on-this-project), for
building and testing this repository itself, and
[Using the components](#using-the-components), for apps that depend on the
published packages. `CLAUDE.md` and `docs/` hold the fuller design and
architecture specification.

## Working on this project

### Packages

| Package | npm | Description |
|---|---|---|
| `@inshapardaz/likhari-core` | [npm](https://www.npmjs.com/package/@inshapardaz/likhari-core) | `EditorFeatureConfig` schema and presets, design tokens, `theme.css`. Framework-free. |
| `@inshapardaz/likhari-converters` | [npm](https://www.npmjs.com/package/@inshapardaz/likhari-converters) | Format converters: plain text, Lexical JSON, HTML, and the extended Markdown dialect. |
| `@inshapardaz/likhari-react` | [npm](https://www.npmjs.com/package/@inshapardaz/likhari-react) | The editor component and toolbar. The primary way to use Likhari from a React app. |
| `@inshapardaz/likhari-webcomponent` | [npm](https://www.npmjs.com/package/@inshapardaz/likhari-webcomponent) | `<likhari-editor>`, for pages without React. |
| `@inshapardaz/likhari-vue` | [npm](https://www.npmjs.com/package/@inshapardaz/likhari-vue) | `<LikhariEditor>`, a thin Vue wrapper over the Web Component. |

```
packages/
  core/            EditorFeatureConfig schema + presets, design tokens/theme.css
  converters/      Format transformers: plain text, Lexical JSON, HTML, Markdown
  react/           @inshapardaz/likhari-react — the editor component + toolbar
  webcomponent/    <likhari-editor>
  vue/             <LikhariEditor>
apps/
  demo/            Vite app for manually exercising the editor
```

### Development

```bash
npm install
npm run dev      # demo app at the printed localhost URL
npm test         # vitest
npm run typecheck
npm run test:e2e # Playwright UI tests (see below)
```

### UI tests (Playwright)

`e2e/` holds integration tests that load the whole editor, through the demo app, in a
real Chromium and drive it the way a user would: formatting, lists, tables, images,
columns, footnotes, poetry, find and replace, spell check, auto-correct, autocomplete,
the thesaurus, import and export, drafts and the leave dialog, languages and RTL, themes
and the feature config.

**Every network call is mocked** (`e2e/support/mocks.ts`): the spelling dictionaries are
replaced with tiny fixtures, WordNet and the Urdu web fonts are answered locally, and any
other request that leaves the app is blocked and fails the test. A test therefore never
depends on the internet or on real dictionary contents.

```bash
npx playwright install chromium   # once
npm run test:e2e                  # against the dev server (starts it for you)
npm run test:e2e:build            # against the production build: run `VITE_BASE=/ npm run build` first
npx playwright test -c e2e/playwright.config.ts find-replace   # one spec file
npx playwright show-report e2e/playwright-report               # after a CI-style run
```

CI runs the suite against the production build in the `UI tests (Playwright)` job of
`.github/workflows/publish.yml`, and the publish job `needs` it, so nothing is published
while a UI test fails. Add new tests next to the feature's existing spec; use
`EditorPage` in `e2e/support/fixtures.ts` rather than raw selectors where you can.

Tests marked `test.fail(...)` document a known bug: they pass while the bug exists and fail
once it is fixed, which is the cue to remove the marker.

### PR previews

Every pull request from a branch in this repo gets its own copy of the demo at
`https://inshapardaz.github.io/likhari/pr-preview/pr-<number>/`, linked in a PR
comment and updated on each push. The preview is removed when the PR is merged
or closed. `main` deploys to the site root. Requires Pages set to
**Deploy from a branch: `gh-pages` / root** (one-time setting).

## Using the components

### Installation

```sh
npm install @inshapardaz/likhari-react @mantine/core @mantine/hooks react react-dom
```

`@mantine/core`, `@mantine/hooks`, `react` and `react-dom` are peer
dependencies — install them alongside the editor. `@inshapardaz/likhari-core`
and `@inshapardaz/likhari-converters` come along as dependencies; install them
directly only if you want their types or functions on their own (feature
config presets, format converters) without the React component.

### Quick start

```tsx
import '@mantine/core/styles.css';
import '@inshapardaz/likhari-react/styles.css';
import { EditorRoot } from '@inshapardaz/likhari-react';

export function App() {
  return (
    <EditorRoot
      documentId="chapter-3"
      featurePreset="standard"
      onSave={(content, format) => console.log(format, content)}
    />
  );
}
```

This renders a toolbar and canvas with the `standard` feature set, autosaves
drafts to `localStorage` as the user types, and calls `onSave` with the
document's content when the toolbar's Save button is pressed. The editor
mounts its own `MantineProvider`, so you do not need to add one yourself —
see [Theming and customization](#theming-and-customization-mantine-headless)
for how it behaves inside an app that already uses Mantine.

From here:

- [React props](#react-props-editorroot) — every prop `<EditorRoot>` takes.
- [Content formats and `setContent`](#content-formats-and-setcontent) — reading
  and writing the document as Markdown, HTML, plain text or Lexical JSON.
- [Drafts and leaving with unsaved changes](#drafts-and-leaving-with-unsaved-changes)
  — autosave, restoring a draft, and guarding navigation.
- [Embedding the editor: Web Component and Vue](#embedding-the-editor-web-component-and-vue)
  — for pages that are not React.

### React props (`<EditorRoot>`)

Every prop is optional. Defaults are shown where they apply.

#### Document and content

| Prop | Type | Default | Description |
|---|---|---|---|
| `documentId` | `string` | none | Names the document. Its drafts are stored under this id, and it is required for `restoreDraft` to find a draft. |
| `initialContent` | `EditorInitialContent` | empty | Content to load when the editor mounts. |
| `onChange` | `(state: SerializedEditorState) => void` | none | Called when the content changes, with the Lexical state. Moving the caret, or changing the view-only font and zoom in uniform mode, does not call it and does not mark the document unsaved. |
| `placeholder` | `string` | the locale's text | Shown while the canvas is empty. |
| `height` | `string \| number` | `'480px'` | Height of the toolbar and canvas together. The canvas scrolls inside it. Accepts any CSS length, such as `'100%'`, `'60vh'` or a number of pixels. |
| `locale` | `Locale` | `'en'` | UI language for labels, tooltips and menus. Also picks the default font and direction. |

#### Features

| Prop | Type | Default | Description |
|---|---|---|---|
| `featurePreset` | `FeatureConfigPresetName` | `'full'` | Starting set of features: `minimal`, `standard`, `full` or `poetry`. |
| `featureConfig` | `EditorFeatureConfig` | from the preset | Turns individual features on or off. Overrides the preset. |
| `fontOptions` | `FontOption[]` | `DEFAULT_FONT_OPTIONS` | Entries in the font-family dropdown. Spread the defaults to add your own. |
| `fontMode` | `'selective' \| 'uniform'` | `'selective'` | `'selective'` styles the selected text with a font family and size. `'uniform'` uses one font for all text and a zoom control in place of the size dropdown. See [Fonts](#fonts). |
| `fontFamily` | `string` | the user's last choice, else the canvas default | `fontMode="uniform"` only. The font family for all text, such as a `fontOptions[].family` value. When set, it overrides the remembered choice. |
| `zoom` | `number` | the user's last choice, else `100` | `fontMode="uniform"` only. Text size as a percentage, 50–300. When set, it overrides the remembered choice. |
| `onFontChange` | `(change: { fontFamily: string \| undefined; zoom: number }) => void` | none | `fontMode="uniform"` only. Called when the user picks a font or zoom in the toolbar. |
| `punctuation` | `PunctuationOptions` | both on | Common punctuation fixes, and whether a straight `"` becomes `”`. |
| `urduNormalization` | `UrduNormalizationOptions` | built-in | Urdu normalisation applied during auto-correct. Set `removeDiacritics` to strip diacritics. |
| `autoCorrectStores` | `AutoCorrectStore[]` | built-in | Where auto-corrections are loaded from and saved to, in priority order. Pass a stable array. |
| `dictionaryStores` | `UserWordStore[]` | built-in | Where words added to the spelling dictionary are saved, in priority order. Pass a stable array. |
| `completionStores` | `CompletionStore[]` | dictionaries and user words | Where autocomplete words come from. Pass a stable array. |
| `autoCompleteLanguage` | `SpellLanguage \| 'auto'` | `'auto'` | Language for autocomplete. `'auto'` follows each block's direction: English for left-to-right, Urdu for right-to-left. |
| `thesaurusStores` | `ThesaurusStore[]` | English WordNet | Where synonyms come from, merged in order. Pass a stable array. |

#### Images and saving

| Prop | Type | Default | Description |
|---|---|---|---|
| `onImageUpload` | `(file: File) => Promise<string>` | none | Stores an uploaded image and returns its URL. Without it, images are embedded as base64, which makes the document large. |
| `fetchImage` | `(url: string) => Promise<Blob>` | browser fetch | Downloads a linked image when it is embedded or edited. Use this to route through your backend when the image server sends no CORS headers. |
| `onSave` | `(content: string, format: FormatId) => void` | none | Called by the Save button with the serialized content. |
| `showSave` | `boolean` | `true` when `onSave` is set | Shows the Save button. Set it to show the button without a handler, or to hide it while keeping `onSave`. The button is enabled only while the document has unsaved changes; saving, `setContent` and loading a document leave it disabled. |

#### Drafts and leaving

| Prop | Type | Default | Description |
|---|---|---|---|
| `autosave` | `boolean` | `true` | Saves drafts to `localStorage` while the user types. |
| `autosaveDelayMs` | `number` | `750` | How long to wait after typing before writing a draft, in milliseconds. |
| `autosaveMaxBytes` | `number` | `2_000_000` | Skips a draft larger than this, so one document cannot fill browser storage. |
| `autosaveMaxDrafts` | `number` | `20` | How many drafts to keep across all documents. The oldest are deleted first. |
| `restoreDraft` | `'prompt' \| 'auto' \| 'off'` | `'prompt'` | On mount, when a newer draft exists: ask the user, load it, or keep the initial content and move the draft aside. |
| `onDraftRestored` | `(draft: { documentId: string; savedAt: number }) => void` | none | Called when a draft is loaded into the editor. |
| `navigationGuard` | `'confirm' \| 'save-draft' \| 'off'` | `'confirm'` | What happens when the user leaves with unsaved changes: ask, save a draft silently, or do nothing. |

#### Appearance

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `MantineThemeOverride` | editor theme | Overrides the Mantine theme, deep-merged over the default. |
| `colorScheme` | `'light' \| 'dark'` | none | Colour scheme for the editor. |
| `accentColor` | `string` | editor default | A CSS colour for the accent. Sets Mantine's primary colour and the toolbar and canvas accent. |
| `toolbarStyle` | `ToolbarStyle` | `{ bordered: true, variant: 'light', overflow: true }` | `bordered` outlines the toolbar and its button groups. `variant` is `'light'`, which tints the active button, or `'filled'`, which fills it with the accent. `overflow: false` lets the toolbar wrap onto multiple rows instead of collapsing into a "..." menu. |
| `helpUrl` | `string \| false` | `DEFAULT_HELP_URL` (the Markdown dialect doc) | URL the toolbar's Help button opens in a new tab. `false` hides the button. |

### Content formats and `setContent`

`ref.getContent(format)` and `ref.setContent(value, format)` accept `'lexical-json'`,
`'plain-text'`, `'html'` and `'markdown'`, and `initialContent`
takes the same formats. `setContent` replaces the document; the new value becomes the
clean baseline (no unsaved changes, and any pending draft of the old content is dropped).
Loading content, through `initialContent` or `setContent`, never counts as an edit: any
adjustment the editor makes while settling the loaded content before the user touches it
is folded into the baseline, so it does not set the unsaved-changes flag, enable the Save
button, call `onChange` or write a draft. Load server content with `setContent` (or
`initialContent` when you have it at mount).

**HTML.** Export writes semantic HTML: paragraphs, headings, quotes, lists (including
nested and checklists), links, tables, images (`<figure>`/`<figcaption>`), rules and page
breaks, with `dir`, `text-align` and `padding-inline-start` for direction, alignment and
indent. Import accepts arbitrary HTML (pasted web pages, other tools' output): inline
formatting from tags or `style`, bare text is wrapped in paragraphs, `<script>`/`<style>`
are dropped, and `javascript:` links and non-image `data:` sources are removed. Import
needs a DOM (`DOMParser`), so it runs in the browser or jsdom, not plain Node.

**Markdown.** The extended dialect (GFM plus `remark-directive` constructs for underline,
sup/sub, colour/background, alignment, indent, direction, captions, page breaks, columns
and poetry layouts) is written up in full, with examples, in
[`docs/markdown-dialect.md`](docs/markdown-dialect.md) — including what each format
round-trips and what degrades. Font family and size are not part of the dialect — a
styled run keeps its other formatting but loses the font on export, keeping Markdown
close to plain GFM.

### Merging pages without the editor

`mergePages` in `@inshapardaz/likhari-converters` combines an array of pages into one
document with a page break between each pair. It needs no editor, React or DOM for
Markdown and Lexical JSON input, so it runs in a server, a worker or a build script.
(HTML input uses `DOMParser`, as above.) The caller picks the output format.

```ts
import { mergePages } from '@inshapardaz/likhari-converters';

const book = mergePages(pageMarkdown, { outputFormat: 'lexical-json' }); // pages are Markdown by default

mergePages(pageJson, { inputFormat: 'lexical-json', outputFormat: 'markdown' });
mergePages([md, { content: json, format: 'lexical-json' }], { outputFormat: 'html' }); // mixed
```

Blank pages are kept by default, so page numbers still line up; pass `skipBlankPages: true` to
leave out pages that are empty, whitespace or only empty paragraphs (a page with a rule, image or
break is not blank), with no stray page break left behind. Footnote ids are only unique within a
page, so a clashing id on a later page is renamed (`1` becomes `1-2`) in its references and
note; every page's notes end up in one list at the end. A page that cannot be read throws an
error naming it (`page 2 is not valid lexical-json: …`). `mergePagesToState` returns the
combined Lexical state instead of a string, to load or post-process it.

**Paragraphs that run across a page.** Pass `joinParagraphs` to merge a page that carries on the
previous page's last paragraph into that paragraph instead of breaking the page. Two modes:

- `joinParagraphs: 'blank-line'` — **an empty line or empty paragraph at the end of a page ends
  its paragraph**; a page without one continues. So the text is the signal: leave a blank line
  where a paragraph really ends and nothing where it runs over. The marker only signals, so it is
  not kept in the output.
- `joinParagraphs: 'punctuation'` — a guess instead: the page continues when its last paragraph
  does not end in `۔ ؟ ! ? . …` (closing quotes and brackets aside; a comma, colon or plain word
  counts as unfinished). Use it for pages that carry no marker.

In both modes pages only join when the next page opens with an unindented paragraph of the same
direction and alignment after a plain paragraph; headings, lists, quotes, tables and blank pages
never join. Joined paragraphs are merged into one, separated by a single space, each run keeping
its formatting. A page break cannot sit inside a paragraph, so **no break is inserted where pages
are joined**.

**Saving the marker.** The editor never trims a trailing empty paragraph, and every format keeps it
through save and load: Lexical JSON, HTML and plain text natively, and Markdown as a `::blank` line
(see [`docs/markdown-dialect.md`](docs/markdown-dialect.md)). For Markdown you write by hand, ending
the page with a blank line (`\n\n`, not just the final newline) works too. Only a run of empty
paragraphs at the very end of a page is written as `::blank`; empty paragraphs in the middle are
still dropped from Markdown.

**From React, Vue or the web component:** it is a plain function, so call it anywhere in app
code, not only inside a component. `npm install @inshapardaz/likhari-converters` and import it
(the React, Vue and web-component packages depend on it, but list it yourself if you import it
directly, since a strict package manager will not expose a transitive dependency). Load the
result with `setContent(merged, 'markdown')` (or whichever output format you chose) on
`EditorRef`, the Vue wrapper or the web component.

### Converting between formats without the editor

`convertContent` in `@inshapardaz/likhari-converters` converts a document from one format to
another, the same way `mergePages` combines pages: a plain function with no editor, React or DOM
needed for Markdown, Lexical JSON and plain text (HTML input uses `DOMParser`). It goes through the
editor's own parsers and serializers, so the result is exactly what the editor would save in the
output format. The text itself is not touched: no spaces are collapsed or trimmed and nothing is
normalised.

```ts
import { convertContent } from '@inshapardaz/likhari-converters';

const html = convertContent(markdown, { inputFormat: 'markdown', outputFormat: 'html' });
const json = convertContent(html, { inputFormat: 'html', outputFormat: 'lexical-json' });
```

Converting a format to itself rewrites it the way the editor writes it (`Title\n=====` becomes
`# Title`). `context` (for example an image URL resolver) and `registry` work as in `mergePages`,
and `convertContentToState` returns the parsed Lexical state instead of a string.

Converting to a format that holds less than the input (rich text to plain text, a table to
Markdown, poetry to plain text) degrades the way that format's fidelity matrix says, see
[`docs/markdown-dialect.md`](docs/markdown-dialect.md) and `docs/lexical-editor-spec.md` §2.2.
Input that cannot be read throws `convertContent: the input is not valid <format>: …`.

### Images

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

### Tables

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

### Fonts

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

#### Uniform mode: one font and a zoom

By default fonts are **selective**: the user picks a font and size for a selection
(or the document), and the choice is stored in the document as inline styles. For
documents that should have a single typeface, set `fontMode="uniform"`:

```tsx
<EditorRoot
  fontMode="uniform"
  fontFamily={`"Noto Nastaliq Urdu", serif`}  // optional; omit for the default
  zoom={125}                                   // optional; 50–300, default 100
  onFontChange={({ fontFamily, zoom }) => saveViewSettings(fontFamily, zoom)}
/>
```

In this mode:

- The toolbar has **one font-family dropdown**, which applies to all text, and a
  **zoom control** instead of the size dropdown. Zoom is laid out as `[−] 100% [+]` as its
  own button group at the right end of the toolbar, just before the drafts and search buttons: − and + step
  through 50–300%, and clicking the percentage resets it to 100%. Zoom scales every size
  together, so headings, superscript and subscript keep their proportions. Right-to-left
  text keeps its larger base size.
- `font.family` shows or hides the font dropdown, and `font.size` the zoom control.
  `font.scope` has no effect.
- The font and zoom are a **view setting, not document content**. Nothing is written
  into the document, so Markdown, HTML, plain text and Lexical JSON exports are
  unchanged, and loading a document does not change them. Text that already carries an
  inline font or size (for example, imported HTML) is displayed in the uniform font and
  zoom, but is not rewritten.
- Without `fontFamily`, each block keeps its direction's default font (Latin
  or Nastaliq), so mixed English and Urdu documents still look right. Once a font is
  chosen it applies to every block.
- **The user's choice is remembered.** A font or zoom picked in the toolbar is saved to
  `localStorage` (under `documentId` when you set one, otherwise shared by the editors
  on the page) and restored on the next load, with no code on your side.
- `fontFamily` and `zoom` are optional starting values. When you pass one it wins over
  the remembered value, and it updates the editor whenever it changes, so leave them out
  to let the user's choice stick. Each toolbar change is also reported through
  `onFontChange`, for example to keep the setting in your own storage instead.

### Drafts and leaving with unsaved changes

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

### Theming and customization (Mantine, headless)

The editor is built on [Mantine](https://mantine.dev): the editor supplies structure,
behavior, and accessibility; a default theme supplies the looks, so it works out of
the box and can be restyled without fighting Mantine's own visuals. Full design
notes: [`docs/mantine-headless-theming.md`](docs/mantine-headless-theming.md).

#### Setup

`@mantine/core` and `@mantine/hooks` are peer dependencies. Import the two
stylesheets once in your app's entry point. The editor renders its own
`MantineProvider`, so you do not need to wrap it.

```tsx
import '@mantine/core/styles.css';
import '@inshapardaz/likhari-react/styles.css';
import { EditorRoot } from '@inshapardaz/likhari-react';

<EditorRoot />   // default theme, no other configuration
```

- Change colors, radius or spacing by setting `--editor-*` CSS variables — this
  works in React, Vue and the Web Component alike.
- Change Mantine defaults (fonts, primary color, component props) with the
  `theme` prop, deep-merged over the default theme.
- Omit `theme` entirely to match an app that already uses Mantine — the editor
  inherits the host's nested `MantineProvider`.

```tsx
<EditorRoot theme={{ primaryColor: 'violet' }} colorScheme="dark" />
```

#### Toolbar appearance

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
- `layout` (default `'classic'`): `'ribbon'` puts the commands on tabs instead of one row, like an
  office ribbon (below).
- `overflow` (default `true`, classic layout only): once the toolbar no longer fits its width, the
  lowest-priority groups move into a "..." menu: first the far-end groups
  (drafts, search and help, then the zoom control in uniform font mode), then
  tools, font and insert. `false` keeps every group inline and lets the toolbar wrap onto as
  many rows as it needs instead.

**Ribbon layout.** With `toolbarStyle={{ layout: 'ribbon' }}` the same commands are grouped into
tabs under a strip of small tab labels; the classic row stays the default, so nothing changes
unless you ask for it.

| Tab | Commands |
|---|---|
| **Home** | block type, bold, italic, underline, strikethrough and the more-formatting menu, alignment, indent, font family and size |
| **Insert** | link, image, rule, table, columns, footnote, page break, poetry couplet |
| **Tools** | auto-correct, correct whole document, spell check, join lines |
| **View** | zoom (shown only in uniform font mode) |
| **Table**, **Poetry**, **Link** | the table, poetry and link commands, as buttons; each tab appears (tinted) only while the caret is in a table, a poetry couplet or a link |

Save, undo and redo (the "Quick access" group) sit **before the tabs**, and drafts, search (find and
replace) and help (the "Document tools" group) sit **after them**; their buttons are flat, with no
border or background (hover tints them, "on" and "unsaved changes" are shown by an accent icon and a
bar or dot). Neither group is on a tab, so
they stay in reach whichever tab is open, and when there are no tabs. A tab with nothing in it (its
features are off) is not shown, so the `minimal` preset has no tabs at all, only those two groups.
**Collapsing.** The chevron at the end of the tab row (or a double-click on a tab, or Ctrl+F1 from the
tabs) hides the command row and leaves only the tab row, giving the canvas the room back; click it
(or double-click a tab) again to bring the row back on the tab you were on. While it is collapsed,
clicking a tab shows that tab's commands in a panel over the canvas, without moving the text: it
closes when you click the tab again, press Escape, click anywhere outside the ribbon, or choose a
command (a dropdown or a menu such as More formatting keeps it open while you pick). Arrow keys move
between collapsed tabs without opening them; Enter or Space opens one. Nothing is collapsible when
there are no tabs (the `minimal` preset). The collapsed state lives in the page, not in storage, so a
reload brings the row back.

A context tab never takes the selection by itself: it appears and you open it when you want it. If
you are on it when the caret leaves, you go back to the first tab. On a narrow screen the active
tab's commands scroll sideways. The tabs are a proper tab list: arrow keys, Home and End move
between them (reversed in a right-to-left editor), and clicking one keeps the caret in the editor.
The web component takes `toolbar-layout="ribbon"` and the Vue wrapper `toolbarLayout="ribbon"`.

#### Help button

The toolbar's Help button opens [`docs/markdown-dialect.md`](docs/markdown-dialect.md)
in a new tab by default — the Markdown format the editor reads and writes,
including the poetry, columns and footnote syntax. Point it at your own docs, or
hide it:

```tsx
import { EditorRoot, DEFAULT_HELP_URL } from '@inshapardaz/likhari-react';

<EditorRoot helpUrl="https://your-app.example/docs/writing" />
<EditorRoot helpUrl={false} /> {/* hide the button */}
```

`DEFAULT_HELP_URL` is exported so you can link to it from your own help centre
instead of replacing it.

#### Behavior worth knowing

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
  available. They do not unregister document node types.

### Browser compatibility

Supported in current stable releases of Chrome, Edge, Firefox and Safari.
Older browsers are not targeted.

| Feature | Requirement | If unsupported |
| --- | --- | --- |
| Logical CSS properties (`margin-inline`, `padding-inline-start`, ...) | Chrome 87+, Edge 87+, Safari 14.1+, Firefox 66+ | Spacing and alignment in RTL content may be wrong. |
| `text-align-last` (justified last line in poetry) | Chrome 47+, Edge 79+, Safari 16+, Firefox 49+ | Single-line poetry lines are not stretched. |
| CSS grid `gap` (columns and two-column poetry) | Chrome 66+, Edge 66+, Safari 12+, Firefox 61+ | Spacing between columns falls back to zero. |
| `ResizeObserver` (toolbar overflow) | Chrome 64+, Edge 79+, Safari 13.1+, Firefox 69+ | The toolbar does not collapse overflowing items. |

Not supported: Internet Explorer and other legacy browsers.

The HTML export writes its styles inline, so exported poetry keeps its
layout outside the editor. It only depends on the logical properties and
`text-align-last` listed above.

### Embedding the editor: Web Component and Vue

Two wrappers are provided for pages that do not use React. Both use the same
editor as the React component, so features and file formats are identical.

#### Web Component (`<likhari-editor>`)

Works in any page, with no framework.

```sh
npm install @inshapardaz/likhari-webcomponent
```

```html
<script type="module" src="/node_modules/@inshapardaz/likhari-webcomponent/dist/likhari-webcomponent.js"></script>

<likhari-editor feature-preset="full" locale="en" height="480px" show-save></likhari-editor>
```

Then import it once in your entry file: `import '@inshapardaz/likhari-webcomponent';`

The bundle is one module with React, the editor and Mantine included. It is
about 2.5MB (about 700KB gzipped). Load it once per page.

**Attributes**

| Attribute | Values | Default |
| --- | --- | --- |
| `feature-preset` | `minimal`, `standard`, `full`, `poetry` | `full` |
| `locale` | `en`, `ur`, `pa-shahmukhi` | `en` |
| `color-scheme` | `light`, `dark` | `light` |
| `accent-color` | any CSS colour | the editor's accent |
| `height` | any CSS length | fills its container |
| `placeholder` | text | none |
| `document-id` | any string; enables autosave for that document | none |
| `show-save` | present (or `"true"`) to show; `"false"` to hide | hidden |
| `autosave` | `"false"` to turn off | on |
| `toolbar-bordered` | present (or `"true"`) to outline the toolbar; `"false"` for a plain toolbar | bordered |
| `toolbar-variant` | `light` (tints the active button), `filled` (fills it with the accent) | `light` |
| `toolbar-layout` | `classic` (one row of command groups), `ribbon` (the commands on tabs) | `classic` |
| `help-url` | any URL; `"false"` to hide the button | the Markdown dialect doc |
| `font-mode` | `selective`, `uniform` (one font for all text and a zoom control; see [Fonts](#fonts)) | `selective` |
| `font-family` | any CSS font-family; uniform mode only | the canvas default |
| `zoom` | a number from 50 to 300; uniform mode only | `100` |

**Property.** Use the `featureConfig` property for fine-grained feature control.
It is nested, so it cannot be an attribute:

```js
const editor = document.querySelector('likhari-editor');
editor.featureConfig = { ...someConfig };
```

**Events.** Both bubble and cross shadow boundaries.

```js
editor.addEventListener('editor-change', (event) => {
  // event.detail: the editor's state
});

editor.addEventListener('editor-save', (event) => {
  // event.detail: { content: string, format: 'markdown' | 'html' | 'plain-text' | 'lexical-json' }
});

editor.addEventListener('editor-font-change', (event) => {
  // uniform mode only. event.detail: { fontFamily: string | undefined, zoom: number }
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

**Spellcheck dictionaries.** The English dictionary is copied into
`dist/dictionaries/en/` beside the bundle and loaded from there. Serve that
folder with the bundle. If you host the bundle somewhere else, point the
editor at your copy from your own code:

```js
import { setEnglishDictionaryBaseUrl } from '@inshapardaz/likhari-react';
setEnglishDictionaryBaseUrl('https://example.com/likhari/dictionaries/en/');
```

**Styles and Shadow DOM.** The element renders into the page, not a shadow
root, because the editor's menus and dialogs are attached to the document. Its
styles are added to the page head once, so your page's own CSS can affect the
editor. Keep the editor's class names (they start with `likhari-`) from being
restyled by global rules.

#### Vue 3 (`<LikhariEditor>`)

A component over the Web Component. Vue 3.5 or later is required.

```sh
npm install @inshapardaz/likhari-vue @inshapardaz/likhari-webcomponent vue
```

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

The Vue package loads the Web Component from its own dependency, so both must
be installed. Keep the `dictionaries/` folder that the Web Component copies
next to its bundle served with your app (see the Web Component section above).

Props match the Web Component's attributes, in camelCase: `documentId`, `locale`,
`colorScheme`, `accentColor`, `placeholder`, `height`, `showSave`, `autosave`,
`featurePreset`, `toolbarBordered`, `toolbarVariant`, `toolbarLayout`, `helpUrl` (a string, or
`false` to hide the button), `fontMode`, `fontFamily`, `zoom` (a number), and
`featureConfig` (an object). Boolean props left unset use the editor's default; they
are not sent as `false`.

Events: `@change`, `@save`, and `@font-change` (payload `{ fontFamily, zoom }`, in
uniform mode).

Template ref methods: `getContent(format)`, `setContent(value, format)`,
`hasUnsavedChanges()`, `confirmDiscard()`, `focus()`.

#### Browser support

Both wrappers follow the editor's [browser compatibility](#browser-compatibility)
requirements.
