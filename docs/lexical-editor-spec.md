# Multilingual Rich Text Editor — Requirements & Specification

Base: [Lexical](https://lexical.dev/)
Primary interop: React (core), with Vue and Web Component wrappers
Theming: Mantine (headless), with a defined default theme

---

## 1. Purpose & Scope

A configurable, embeddable rich text editor component supporting English, Urdu, and
Punjabi (Shahmukhi), with import/export across Markdown (primary format), HTML, plain
text, and native Lexical JSON. The component must be usable as:

- A React component (native, first-class)
- A Vue component (wrapped)
- A framework-agnostic Web Component (wrapped, for use in any stack)

Every feature must be independently toggleable via props/config, so consumers can ship
a minimal editor (e.g. plain-text notes) or the full-featured version from the same
codebase.

### 1.1 Non-goals (initial release)

- Real-time multi-user collaboration (CRDT sync) — architecture should not preclude it
  later (Lexical supports Yjs bindings), but it is out of scope for v1.
- Server-side rendering of the editor itself (read-only rendering of exported HTML/MD
  is fine and expected).
- Mobile native (iOS/Android) apps — web/mobile-web only.

---

## 2. Supported File Formats

| Format | Role | Notes |
|---|---|---|
| Markdown | **Primary** interchange format | Needs a custom dialect (see 2.1) to round-trip features Markdown doesn't natively support (poetry layouts, columns, footnotes, colors, font, alignment, checklists, superscript/subscript, page breaks). |
| HTML | Secondary export/import, embed target | Needed for pasting from web pages and for embedding output in web contexts. |
| Plain text | Lowest common denominator | Strips all formatting; used for copy-out, previews, search indexing. |
| Lexical JSON | Native/lossless | The only format that round-trips 100% of state (custom nodes, exact attributes). Used for autosave and internal storage. |

### 2.1 Markdown dialect decision

Since Markdown is the primary format but the feature set exceeds CommonMark/GFM, define
an explicit **extended Markdown dialect** up front rather than discovering gaps later:

- **Native GFM**: bold, italic, strikethrough, headings (1–6), blockquote, ordered/
  unordered lists, links, images, tables, horizontal rule.
- **Extended via directives/attributes** (recommend the
  [Pandoc-style bracketed span / fenced div](https://pandoc.org/MANUAL.html#extension-fenced_divs)
  convention, or a custom `:::` fenced-block syntax), for: underline, superscript,
  subscript, text/background color, font family/size, alignment, indent level,
  checklists (GFM already has `- [ ]` / `- [x]`), page breaks, columns, footnotes
  (GFM-style `[^1]`), and poetry layout blocks.
- **Fallback rule**: anything the dialect cannot express (e.g. an unusual color) is
  preserved as an HTML comment or inline attribute so a Markdown → Lexical JSON → Markdown
  round trip doesn't silently drop data. Document this "lossy but recoverable" behavior
  clearly to consumers.
- Ship a written spec for this dialect (separate doc) since it becomes a contract for
  anyone consuming exported Markdown outside the editor.

### 2.2 Conversion architecture

- Build one **canonical intermediate representation** — the Lexical `EditorState` (JSON)
  tree — and write bidirectional transformers for each format against that
  representation, rather than N×N converters between formats directly.
- Each transformer is a pair: `serialize(editorState) → string` and
  `parse(string) → editorState`.
- Provide a documented **fidelity matrix** (which features survive a round trip in each
  format) as part of the deliverable, e.g.:

| Feature | MD (ext.) | HTML | Plain text | Lexical JSON |
|---|---|---|---|---|
| Bold/italic/underline/strike | ✅ | ✅ | ❌ (stripped) | ✅ |
| Superscript/subscript | ✅ (ext.) | ✅ | ❌ | ✅ |
| Colors/font/size | ✅ (ext.) | ✅ | ❌ | ✅ |
| Tables | ✅ | ✅ | ✅ (degraded/plain grid) | ✅ |
| Columns layout | ✅ (ext.) | ✅ | ❌ (linearized) | ✅ |
| Footnotes | ✅ (ext.) | ✅ | ✅ (inline `[1]` + list) | ✅ |
| Poetry layout variants | ⚠️ (ext., approximate) | ✅ | ⚠️ (linearized) | ✅ |
| Page break | ✅ (ext.) | ✅ (`<div style="page-break-after">`) | ❌ | ✅ |

- Import must be **defensive**: malformed Markdown/HTML should degrade gracefully
  (best-effort parse) rather than throwing, with a reported list of dropped/unsupported
  constructs the host app can surface if desired.

---

## 3. Language Support

### 3.1 Languages

- English (LTR)
- Urdu (RTL, Nastaliq/Naskh script rendering via Arabic script Unicode block)
- Punjabi — **Shahmukhi** script specifically (RTL, Arabic-script-based, distinct
  character set/orthography from Urdu — not just a font swap)

### 3.2 Implications

- **Editor direction**: the root and each block node need a `direction` (`ltr`/`rtl`)
  and should support **mixed-direction documents** (e.g. an English heading inside an
  Urdu document, or a Punjabi couplet embedded in an English essay). Lexical's node-level
  `dir` support plus the Unicode Bidirectional Algorithm (`unicode-bidi: plugin-text` /
  `isolate`) must be applied per block, not just globally on the editor root.
- **"Start"/"End" alignment** (explicitly requested in the feature list) exists precisely
  because "left" and "right" are meaningless across LTR/RTL — implement alignment as
  logical values (`start`, `end`, `center`, `justify`) that resolve to physical
  left/right based on the block's own `dir`, in addition to explicit "Left align" /
  "Right align" as literal overrides for cases where a user genuinely wants a fixed
  physical side regardless of paragraph direction (this is common in poetry layouts,
  see §7).
- **Font stack**: Urdu and Punjabi need Nastaliq-capable fonts (e.g. Jameel Noori
  Nastaleeq, Noto Nastaliq Urdu) for Urdu, and appropriate Shahmukhi-compatible fonts for
  Punjabi (Noto Nastaliq Urdu covers Shahmukhi's character repertoire reasonably well,
  but validate against Punjabi-specific diacritics). These render noticeably taller/
  wider per line than Latin fonts — line-height and toolbar/menu layout must account for
  this rather than assuming Latin metrics.
- **Input**: Nastaliq shaping is complex (contextual, non-linear cursor behavior in some
  renderers). Rely on the browser's native complex-text-shaping (via `contenteditable`)
  rather than custom shaping logic; validate cursor movement, backspace, and selection
  behavior specifically in Nastaliq fonts since some have historically had rendering
  quirks in Chromium/WebKit.
- **UI localization**: toolbar labels, tooltips, menus, and dialogs need translated
  strings for English/Urdu/Punjabi (an i18n layer — e.g. `react-i18next` — not just
  editor-content direction).
- **Numerals**: decide whether Urdu/Punjabi content uses Eastern Arabic-Indic numerals or
  Latin digits for footnote markers, list numbering, etc., and make it configurable.

---

## 4. Feature Specification

### 4.1 Text formatting

| Feature | Lexical implementation | Notes |
|---|---|---|
| Bold, Italic, Underline, Strikethrough | Native `TextFormatType` | Built-in. |
| Superscript, Subscript | Native `TextFormatType` | Built-in; mutually exclusive with each other. |
| Uppercase, Lowercase, Capitalize | **Custom** — not a Lexical format flag | These are one-shot **text transforms**, not persistent style flags (unlike bold/italic, they mutate the actual text content). Implement as a toolbar action that rewrites selected `TextNode` text via `.setTextContent()`, with correct treatment of Unicode case-mapping — note **Urdu/Punjabi (Arabic script) have no case concept**, so these three actions should auto-disable/hide for RTL Arabic-script content and only apply to Latin-script runs (support mixed-script paragraphs correctly). |
| Clear formatting | Custom command | Strips all format flags and resets font/size/color overrides on the selection to inherited/default. |

### 4.2 Lists

| Feature | Implementation |
|---|---|
| Numbered list | `@lexical/list` `ListNode` (type `number`) |
| Bullet list | `@lexical/list` `ListNode` (type `bullet`) |
| Check list | `@lexical/list` `ListNode` (type `check`) with `ListItemNode.checked` |

### 4.3 Block structure

| Feature | Implementation |
|---|---|
| Headings (H1–H6) | `@lexical/rich-text` `HeadingNode`, tags `h1`–`h6` |
| Quote | `@lexical/rich-text` `QuoteNode` |
| Horizontal rule | `@lexical/react` `HorizontalRuleNode` |
| Page break | **Custom node** (`PageBreakNode`) — no Lexical built-in; renders as a visible marker in-editor and as CSS `page-break-after: always` / an explicit block in export formats. Relevant mainly for print/PDF export and paginated Word-style documents. |

### 4.4 Alignment & indentation

- Left / Right / Center ("Middle") / Justify / **Start-aligned** (logical) — see §3.2 for
  the LTR/RTL rationale. Implement via `ElementNode.setFormat()` (Lexical natively
  supports `left | right | center | justify | start | end`).
- Indent / Outdent — native `ElementNode.setIndent()`, respecting `dir` (indent visually
  moves toward the block's logical "start").

### 4.5 Font & color

| Feature | Scope options | Implementation |
|---|---|---|
| Font family | Selection **or** entire document | `TextNode` style override (`font-family`) for selection; a document-level default (theme/config value) applied via the root editor theme when no override is applied. |
| Font size | Selection **or** entire document | Same pattern as font family, `font-size` style. |
| Background color (highlight) | Selection | `TextNode` style `background-color`. |
| Foreground color | Selection | `TextNode` style `color`. |

Font/color pickers should offer both a curated palette (for Mantine-consistent theming)
and a free color picker/custom font input.

### 4.6 Editing

- Undo / Redo — Lexical's built-in `HistoryPlugin` (`@lexical/history`), which already
  handles merging of rapid keystrokes into coalesced history entries.

### 4.7 Links & media

- **URL insert**: link dialog with URL + display text + optional "open in new tab",
  built on `@lexical/link`.
- **Image**:
  - *Linked* image (external URL reference).
  - *Embedded* image (base64 data URI, or uploaded and referenced by a host-provided
    upload handler — recommend supporting a pluggable `onImageUpload(file) → url`
    callback so consumers can wire their own storage/CDN rather than forcing base64
    bloat into the document).
  - *Caption*: custom `ImageNode` extended to hold an editable caption
    (`figure`/`figcaption` semantics on HTML export).

### 4.8 Tables

- `@lexical/table` — row/column insert/delete, header rows, cell merge is a known
  Lexical limitation to scope-check early (native table plugin has partial merge
  support; validate against your exact requirements before committing to a scope).

### 4.9 Columns layout

- **Custom** `LayoutContainerNode` + `LayoutItemNode` (Lexical's playground has a
  reference implementation of exactly this pattern — multi-column containers with
  configurable column counts/ratios). Needed both as a general "columns" feature and as
  the structural basis for two-column poetry layouts (§4.11).

### 4.10 Footnotes

- **Custom** node pair: an inline `FootnoteReferenceNode` (superscript marker in text)
  and a document-level footnote list rendered at the bottom (or a `FootnoteNode`
  maintained in a side registry keyed by ID, similar to how comments/annotations are
  often implemented in Lexical). No built-in Lexical support — this is one of the larger
  custom-engineering items in the project.
- Renumbering on insert/delete/reorder must be automatic.
- Export: Markdown (`[^1]` + reference block), HTML (`<sup>`+ anchor + list), plain text
  (inline bracketed number + trailing list).

### 4.11 Urdu poetry layout templates

This is a distinctive, non-trivial requirement — effectively a small set of **custom
block node types** purpose-built for Urdu/Punjabi verse, since none of these map to
standard paragraph/heading semantics:

| Template | Structure | Suggested implementation |
|---|---|---|
| Single-column, justified/left-aligned, paragraph break between couplets | Two-line couplet as one block, blank paragraph gap between couplets | A `CoupletNode` (2 lines) with configurable alignment; sequence of these separated by spacer nodes. |
| Two-column poetry | Each couplet's two lines (misra) sit side by side in two columns | Built on the columns layout primitive (§4.9): a `PoetryRowNode` = a 2-column `LayoutContainer` with one misra per column. |
| Two-column poetry with some couplets single-column justified | Mixed — need per-couplet layout override | Allow each `CoupletNode`/`PoetryRowNode` in a sequence to independently declare its own layout mode; toolbar action to convert a given couplet between modes. |
| Single-column justified, with some couplets left-aligned and others right-aligned | Per-couplet alignment override within a single-column flow | Alignment is set per `CoupletNode`, not inherited from a document-wide setting — this is the same underlying need as the previous row (per-block override), just varying alignment instead of column count. |

**Design recommendation**: rather than four bespoke node types, implement one
`PoetryBlockNode` type with a `layout` attribute (`single` | `two-column`) and an
`alignment` attribute (`justify` | `left` | `right` | `start`) settable per instance,
and let editors mix instances of it freely in a document. This covers all four
requested templates (and combinations of them) with one extensible primitive instead of
four fixed templates, and makes future variants (e.g. three-line forms) cheaper to add.

Provide a "poetry mode" toolbar/insert menu specific to Urdu/Punjabi editing contexts
(hidden entirely when the feature is disabled via props, see §5).

---

## 5. Feature Toggling / Configuration Props

Every feature above must be individually controllable, not just "rich text on/off".
Recommend a single nested config object rather than dozens of flat boolean props, e.g.:

```ts
interface EditorFeatureConfig {
  formatting?: {
    bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean;
    superscript?: boolean; subscript?: boolean;
    caseTransforms?: boolean; // uppercase/lowercase/capitalize
    clearFormatting?: boolean;
  };
  lists?: { numbered?: boolean; bullet?: boolean; check?: boolean };
  blocks?: {
    headingLevels?: (1|2|3|4|5|6)[]; // e.g. restrict to h1–h3
    quote?: boolean; horizontalRule?: boolean; pageBreak?: boolean;
  };
  alignment?: { left?: boolean; right?: boolean; center?: boolean; justify?: boolean; start?: boolean };
  indent?: boolean;
  font?: { family?: boolean; size?: boolean; scope?: 'selection' | 'document' | 'both' };
  color?: { foreground?: boolean; background?: boolean; palette?: string[] };
  history?: boolean; // undo/redo
  links?: boolean;
  images?: { linked?: boolean; embedded?: boolean; caption?: boolean; maxSizeMB?: number };
  tables?: boolean;
  columns?: boolean;
  footnotes?: boolean;
  poetry?: { enabled?: boolean; defaultLayout?: 'single' | 'two-column' };
  findReplace?: boolean;
  language?: {
    spellCheck?: boolean; thesaurus?: boolean; autocomplete?: boolean;
    autocorrect?: boolean; textCleanup?: boolean;
  };
  formats?: { markdown?: boolean; html?: boolean; plainText?: boolean; lexicalJson?: boolean };
}
```

- Toolbar/menu UI should render conditionally based on this config so disabled features
  don't just fail silently but are actually absent.
- Provide a small set of **presets** (`minimal`, `standard`, `full`, `poetry`) built on
  top of this config for convenience, while still allowing full override.

---

## 6. Persistence & Document Lifecycle

### 6.1 Document identity

- `documentId` prop (string, required for persistence features to activate). All
  localStorage keys, draft recovery, and autosave scoping are namespaced by this ID
  (e.g. `editor:draft:{documentId}`).

### 6.2 Autosave to localStorage

- Debounced write (e.g. 500ms–1s after last change) of the current Lexical JSON state to
  `localStorage`, keyed by `documentId`.
- On mount, if a draft exists for the given `documentId` **and** differs from the
  initial content passed in, prompt the user to restore the draft vs. discard it
  (data-loss prevention is the explicit goal here — don't silently overwrite either the
  draft or the incoming content).
- Store a timestamp + a hash/version marker alongside the draft so stale drafts (e.g.
  from a much older session, or after the "real" doc was saved elsewhere) can be
  distinguished from genuinely unsaved recent work.
- `localStorage` has a ~5–10MB per-origin ceiling shared across the whole site — cap
  draft size (e.g. warn/refuse to autosave documents with embedded base64 images beyond
  a threshold) and expose this limit as a configurable constant.
- Clear the stored draft on successful explicit save (§6.3) so it doesn't linger and
  falsely trigger a "restore draft?" prompt next time.

### 6.3 Explicit save

- Optional "Save" button (toggleable via props) that fires an `onSave(content,
  format)` callback — the host application owns actual persistence (API call, etc.); the
  editor does not assume a backend.
- When the save button is hidden, decide (configurable) whether saving is fully
  autosave-only (localStorage) or whether the host drives saves externally via an
  imperative ref method (`editorRef.current.getContent(format)`).

### 6.4 Navigation guard / unsaved changes prompt

- Track a dirty flag (content differs from last-saved snapshot).
- On:
  - Document switch within the same app (host calls a `loadDocument(id)`-style API),
  - Browser tab close/refresh (`beforeunload`),
  - SPA route navigation (host framework's router guard — this must be exposed as a hook/
    callback since the editor can't intercept e.g. React Router or Vue Router navigation
    on its own),

  show a confirmation dialog if dirty, and only proceed on confirmation. Expose this as
  both an automatic `beforeunload` handler (for browser-level navigation) and a
  `hasUnsavedChanges()` / `confirmDiscard()` imperative API the host app's router guard
  can call (for in-app navigation, which the editor cannot intercept on its own).

---

## 7. Find & Replace

- Standard find (highlight all matches, next/prev, match count) and replace
  (single/all), case-sensitive and whole-word toggles.
- Should operate over the plain-text projection of the document but replace within the
  correct rich-text nodes without destroying formatting on unaffected text.
- No built-in Lexical plugin for this — implement via a text-search index over the
  `EditorState` rebuilt on change (or debounced), with `TextNode.splitText()` to isolate
  matched ranges for replacement.

---

## 8. Language Tooling

| Feature | Approach |
|---|---|
| Spell checker | Per-language dictionaries. **Hunspell** (`.aff`/`.dic`) has community dictionaries for Urdu; Punjabi/Shahmukhi Hunspell dictionaries are far less mature — this is a real risk item, flag it early and validate dictionary availability/quality before committing to a checker UX for Punjabi. Run via a WASM Hunspell port (e.g. `nspell`/`hunspell-asm`) in a Web Worker to avoid blocking the main thread, decorate misspelled ranges as a Lexical `Mark`/decorator node rather than mutating text. |
| Thesaurus | "Golden dict"-style lookup (as referenced) — a local/offline synonym dataset per language queried on right-click/context menu. English has mature open datasets (WordNet); Urdu/Punjabi synonym datasets are sparse — scope this as English-first, with Urdu/Punjabi as best-effort/optional depending on data availability. |
| Autocomplete | Inline suggestion (ghost text or dropdown) driven by a per-language frequency dictionary or the same Hunspell affix data; should be unobtrusive (Tab/Enter to accept, Esc to dismiss) and language-aware (switches dictionary based on the direction/script of the current block, for mixed-language documents). |
| Autocorrect | Rule-based, on word-boundary (space/punctuation) commit — common typo tables per language, toggleable per-language since users writing bilingual documents will want different behavior in Urdu vs. English regions of text. |
| Text cleanup | A "clean up" command: normalize whitespace/line breaks, strip empty formatting spans, fix common paste artifacts (smart quotes inconsistency, stray `<span>` wrappers from Word/Google Docs paste), normalize Unicode (NFC) — particularly important for Arabic-script text where visually-identical characters can have different underlying code points/combining sequences. |

All language-tooling checks should run in a **Web Worker**, not the main thread —
spellcheck/autocomplete over a large document is exactly the kind of work that causes
input lag if done synchronously in the editor's update cycle.

---

## 9. Framework Interop

### 9.1 React (primary)

- The actual implementation target — built directly on `@lexical/react`.

### 9.2 Vue

- Two viable approaches:
  1. Wrap the finished Web Component (§9.3) and use it from Vue via
     `defineCustomElement`/native custom-element interop — least duplicate code, but
     loses some ergonomics (props become attributes/properties, events become
     CustomEvents).
  2. A dedicated Vue composable/component that talks to Lexical's framework-agnostic
     core (`lexical` + `@lexical/*` core packages, without `@lexical/react`) directly —
     more idiomatic Vue API, more implementation/maintenance cost.

  **Recommendation**: start with (1) — wrap the Web Component — for parity and lower
  maintenance burden; revisit (2) only if the Web Component's props/events interface
  proves too limiting for real Vue consumers.

### 9.3 Web Component

- Wrap the React implementation using a proven interop layer
  (e.g. [`@r2wc/react-to-web-component`](https://github.com/bitovi/react-to-web-component)
  or a hand-rolled `HTMLElement` + `ReactDOM.createRoot` shim) so the same React
  component tree backs the custom element — avoids maintaining two editor
  implementations.
- Props map to HTML attributes for primitives (strings/booleans) and to element
  properties for complex objects (the `EditorFeatureConfig`, since deeply nested config
  doesn't serialize cleanly to attributes).
- Editor events (`onChange`, `onSave`, dirty-state changes) dispatch as `CustomEvent`s
  (`editor-change`, `editor-save`, etc.) for framework-agnostic listening.
- Shadow DOM: decide explicitly whether to use it. Pros: style isolation from host page.
  Cons: Mantine's theming and any global font-loading (for Nastaliq fonts) need to be
  explicitly pierced into the shadow root (`adoptedStyleSheets` or `<link>` injection) —
  don't assume host-page CSS reaches inside.

---

## 10. Theming (Mantine, headless)

- Use Mantine in **headless mode** (`@mantine/core` styles API / `unstyled` components,
  or Mantine's headless primitives) so the editor supplies structure/behavior and the
  consuming app can restyle without fighting default Mantine visuals — while still
  shipping a complete, good-looking **default theme** out of the box.
- Default theme should define: color palette (including a coherent set for the
  background/foreground color picker), typography scale for both Latin and Nastaliq
  fonts (these need different base sizes/line-heights to look balanced), toolbar
  density/spacing, and dark-mode variants.
- Theme should be overridable via a `theme` prop (Mantine `MantineThemeOverride`) at the
  React layer, and via CSS custom properties at the Web Component boundary for
  non-React consumers who can't pass a Mantine theme object directly.

---

## 11. Non-Functional Requirements

- **Performance**: editor must stay responsive (no input lag) at large document sizes
  (target: define a concrete ceiling, e.g. 50k words / 500 nodes, and benchmark against
  it) — spellcheck/autocomplete/thesaurus must run off-thread (§8) precisely because of
  this.
- **Accessibility**: toolbar controls keyboard-navigable and screen-reader labeled;
  contenteditable region exposes appropriate ARIA roles; color contrast in default theme
  meets WCAG AA at minimum.
- **Browser support**: define target matrix explicitly (recommend: last 2 versions of
  Chrome/Edge/Firefox/Safari) — Nastaliq font shaping and `contenteditable` RTL behavior
  are exactly the areas most likely to have cross-browser inconsistencies, so this
  should be tested early, not assumed.
- **Data safety**: no feature should be able to silently lose content — this is the
  through-line behind autosave, the restore-draft prompt, and the navigation guard; treat
  it as a top-level acceptance criterion, not just a feature checkbox.
- **Bundle size**: Lexical is already fairly lean, but Hunspell/WASM dictionaries per
  language, Nastaliq web fonts, and Mantine can add up — lazy-load per-language
  dictionaries/fonts on demand (only load Urdu spellcheck assets if the document/config
  actually uses Urdu) rather than bundling everything up front.

---

## 12. Key Risks & Open Questions

These should be resolved or prototyped early since they affect architecture decisions
downstream:

1. **Punjabi Shahmukhi tooling maturity** — spellcheck/thesaurus/autocorrect data quality
   for Shahmukhi is likely the weakest link in the whole spec. Validate available
   dictionaries before committing to feature parity with English/Urdu.
2. **Extended Markdown dialect** — needs to be specified and versioned as a first-class
   deliverable (it's effectively a new file format), not treated as an implementation
   detail. Get sign-off on the dialect spec before building converters against it.
3. **Table cell merge** — check Lexical's current `@lexical/table` capabilities against
   your actual requirement (the request doesn't specify merge, but "table support" often
   implies it) before scoping.
4. **Poetry node design** — recommend validating the single flexible `PoetryBlockNode`
   approach (§4.11) with real Urdu-poetry sample documents early, since edge cases in
   verse formatting are easy to underestimate from a spec alone.
5. **Web Component prop serialization** for the nested `EditorFeatureConfig` — decide the
   attribute/property convention early since it affects every non-React consumer's
   integration code.
6. **Collaboration** — confirmed non-goal for v1 (§1.1), but worth explicitly designing
   the node schema (especially the custom poetry/footnote/layout nodes) to remain
   Yjs-compatible, since retrofitting CRDT support onto custom nodes designed without it
   in mind is significantly harder than designing for it from the start.

---

## 13. Suggested Phasing

| Phase | Scope |
|---|---|
| 1 | Core React editor: basic formatting, lists, headings, alignment/indent, undo/redo, plain text + Lexical JSON I/O, feature-flag config scaffolding, default Mantine theme, English only. |
| 2 | Add Urdu/Punjabi (BiDi, fonts, logical alignment), Markdown + HTML I/O (incl. extended dialect draft), links/images/tables, autosave + navigation guard. |
| 3 | Columns, footnotes, poetry layout node, find/replace, page break. |
| 4 | Language tooling (spellcheck → autocomplete/autocorrect → thesaurus, in that priority order given data-availability risk), text cleanup. |
| 5 | Vue wrapper, Web Component packaging, theming polish, performance/accessibility hardening against the NFRs in §11. |

