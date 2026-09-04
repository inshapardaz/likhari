# Technical Architecture Design

Companion to `lexical-editor-spec.md`. This defines *how* the requirements get built:
package layout, node schema, plugin system, data flow, and the public API surface.

---

## 1. Monorepo / package layout

Recommend a monorepo (pnpm/turborepo or nx) so the React core, wrappers, and
converters can version and release independently but share types.

```
packages/
  core/                     # framework-agnostic pieces where possible
    nodes/                  # custom Lexical node classes (see §3)
    plugins/                # Lexical plugins, framework-agnostic logic where possible
    config/                 # EditorFeatureConfig schema + presets + validation
    theme/                  # default Mantine theme tokens, CSS variables
  react/                    # @yourscope/editor-react — the primary implementation
    components/             # Toolbar, MenuBar, Dialogs (link, image, table, poetry)
    plugins/                # React-bound plugin wrappers (@lexical/react hooks)
    index.ts                # public component + ref API
  converters/               # format transformers, isolated from UI
    markdown/                 # extended MD dialect (serialize/parse)
    html/
    plain-text/
    lexical-json/
  language-services/        # spellcheck/thesaurus/autocomplete/autocorrect
    workers/                 # Web Worker entry points
    dictionaries/            # per-language, lazy-loaded chunks
  webcomponent/              # wraps react/ via react-to-webcomponent
  vue/                       # wraps webcomponent/ (see spec §9.2)
  docs/                      # Markdown dialect spec, fidelity matrix, ADRs
```

**Why split `core` from `react`**: nodes, config schema, and (as much as possible)
plugin *logic* should not import React. This is what makes the Web Component and any
future non-React consumer viable without a second implementation — the React package
becomes a thin binding layer over `core` plus `@lexical/react` hooks for lifecycle.
Where a plugin genuinely needs React (e.g. a dialog that uses Mantine components), keep
the *command/state logic* in `core` and only the rendered UI in `react`.

---

## 2. Editor composition (top level)

```
<EditorRoot config={featureConfig} documentId="..." initialContent={...} onSave={...}>
  <LexicalComposer initialConfig={...}>       // registers all nodes up front
    <Toolbar />                                // reads config, renders enabled controls
    <RichTextPlugin />                         // Lexical's contenteditable + placeholder
    <HistoryPlugin />                          // undo/redo, config.history
    <ListPlugin /> <TablePlugin /> ...         // one per feature, conditionally mounted
    <PoetryPlugin />                           // custom
    <FootnotePlugin />                         // custom
    <LayoutPlugin />                           // custom (columns + poetry two-column)
    <AutosavePlugin documentId .../>           // custom, §6
    <NavigationGuardPlugin />                  // custom, §6
    <LanguageServicesPlugin />                 // custom, spawns workers, §7
    <OnChangePlugin onChange={...} />
  </LexicalComposer>
</EditorRoot>
```

**Node registration is the one thing that cannot be conditional** — Lexical requires
all node types used anywhere in a document to be registered on the editor at
construction time, or it throws on encountering an unregistered node type during
`parseEditorState`. Two consequences for the config system:

1. All custom nodes (poetry, footnote, layout, page break, image) are **always
   registered**, regardless of `EditorFeatureConfig`.
2. The config instead controls **whether the *toolbar/insert UI* for a node type is
   exposed**, and a **paste/import sanitizer** strips or downgrades disallowed node
   types coming from pasted HTML or an imported document that used a feature the host
   has disabled. This distinction (registration vs. availability) needs to be explicit
   in the plugin implementations, not left implicit.

---

## 3. Custom node schema

All custom nodes live in `packages/core/nodes/`, one file per node, following Lexical's
standard node contract (`getType`, `clone`, `importJSON`, `exportJSON`, `createDOM`,
`updateDOM`, and `importDOM`/`exportDOM` for HTML round-trip).

### 3.1 `PoetryBlockNode` (extends `ElementNode`)

```ts
type PoetryLayout = 'single' | 'two-column';
type PoetryAlign = 'justify' | 'left' | 'right' | 'start';

class PoetryBlockNode extends ElementNode {
  __layout: PoetryLayout;
  __align: PoetryAlign;
  // children: for 'single' layout, two ParagraphNode misras stacked;
  // for 'two-column' layout, internally composes a LayoutContainerNode
  // with two LayoutItemNodes (one misra each) — see §4 note on composition.
}
```

- `setLayout()` / `setAlign()` mutate the node in place (same node identity, different
  rendering) so converting a couplet between layouts doesn't require deleting/
  recreating it and losing selection/undo coherence.
- A document is a sequence of `PoetryBlockNode`s (and ordinary paragraphs, for prose
  interleaved with verse) — this directly satisfies all four poetry templates in the
  spec as combinations of per-instance `layout`/`align`, rather than four fixed node
  types.

### 3.2 `LayoutContainerNode` + `LayoutItemNode` (extend `ElementNode`)

- `LayoutContainerNode.__columnCount: number`, optionally `__columnWidths: string[]`
  (e.g. `['50%','50%']` or `['1fr','1fr']`) for uneven splits.
- `LayoutItemNode` is a generic column cell holding arbitrary block content.
- Reused as the implementation detail behind `PoetryBlockNode`'s two-column mode (see
  hierarchy diagram above) — one primitive, two call sites.

### 3.3 `FootnoteReferenceNode` (extends `TextNode`, or a small `DecoratorNode`)

- Holds `__footnoteId`. Renders as a superscript numeral whose *displayed* number is
  computed at render time from document order (not stored), so insert/delete/reorder
  auto-renumbers.
- The footnote *content* itself is not a child of this node — it's held in a
  **document-level registry** (a plain object keyed by `footnoteId`, persisted
  alongside the `EditorState` — see §5) and rendered as a list at the document's end by
  a `FootnoteListPlugin`. This mirrors how comments/annotations are typically modeled
  in Lexical (reference in the flow, content out-of-band) and avoids the awkwardness of
  a node whose "content" lives far from where it's anchored.

### 3.4 `PageBreakNode` (extends `DecoratorNode`, no editable content)

- Renders a visible divider in-editor; exports to CSS `page-break-after: always` in
  HTML, a custom fence in the Markdown dialect, and is dropped (or converted to a
  paragraph break) in plain text.

### 3.5 `ImageNode` (extends `DecoratorNode`)

- `__src`, `__altText`, `__caption` (editable nested text, or a lightweight editable
  child), `__linkType: 'linked' | 'embedded'`, `__width`/`__height` for resize.
- Caption is a real editable region, not a plain string prop — implement it as a small
  isolated Lexical sub-editor node or a controlled `contenteditable` span, and decide
  which before implementation since it affects undo/redo scoping (a nested editor gets
  its own history unless explicitly bridged to the parent).

### 3.6 Style-only extensions (no new node types)

Superscript/subscript, colors, font family/size, background highlight are **not**
custom nodes — they're `TextNode` format flags / inline style overrides, already
covered by Lexical's built-in `TextNode`. Uppercase/lowercase/capitalize are **not**
persisted state at all — they're one-shot commands that call `.setTextContent()` on the
selected `TextNode`s and produce no new node type or attribute.

---

## 4. Plugin architecture

One plugin per feature area, each independently registerable, matching the shape of
`EditorFeatureConfig`:

| Plugin | Registers | Reads from config |
|---|---|---|
| `FormattingPlugin` | toolbar buttons for bold/italic/.../case transforms/clear | `config.formatting.*` |
| `ListPlugin` | `@lexical/list` | `config.lists.*` |
| `BlocksPlugin` | headings/quote/hr/page break | `config.blocks.*` |
| `AlignmentPlugin` | alignment/indent commands | `config.alignment`, `config.indent` |
| `FontColorPlugin` | font family/size/color pickers | `config.font`, `config.color` |
| `LinkPlugin` | `@lexical/link` + dialog | `config.links` |
| `ImagePlugin` | `ImageNode` insert UI, upload handler wiring | `config.images.*` |
| `TablePlugin` | `@lexical/table` | `config.tables` |
| `LayoutPlugin` | columns insert UI | `config.columns` |
| `FootnotePlugin` | `FootnoteReferenceNode` insert, renumbering, `FootnoteListPlugin` | `config.footnotes` |
| `PoetryPlugin` | poetry insert menu, per-couplet layout toggle UI | `config.poetry.*` |
| `FindReplacePlugin` | search overlay, match navigation | `config.findReplace` |
| `LanguageServicesPlugin` | spawns/manages workers, decorator marks for spellcheck | `config.language.*` |
| `AutosavePlugin` | localStorage draft read/write, restore-draft prompt | always on if `documentId` present |
| `NavigationGuardPlugin` | dirty tracking, `beforeunload`, exposes `hasUnsavedChanges()` | always on |

Each plugin follows the same pattern: check its config flag; if disabled, render
nothing and register no commands/toolbar entries (but its node types, if any, remain
registered per §2's registration-vs-availability rule).

---

## 5. Data flow / state management

- **Single source of truth**: the Lexical `EditorState` (immutable, versioned tree).
  No parallel React state duplicating document content — React components read
  derived/selected state via `useLexicalComposerContext` + `editor.getEditorState()`
  and Lexical's own `update`/`read` transactions, not a separate store.
- **Controlled vs. uncontrolled**: support both. Uncontrolled (editor owns state
  internally, host reads via `onChange`/ref) is the default and recommended mode,
  matching Lexical's own idioms. A fully controlled mode (host passes `content` and the
  editor reconciles) is offered for hosts that need it, but flagged in docs as more
  expensive (full reconciliation on every host-driven update) and easier to misuse
  (fighting the editor's own transactions).
- **Cross-cutting concerns** (autosave, dirty-tracking, language services) subscribe to
  `editor.registerUpdateListener()` rather than hooking into individual feature
  plugins — this keeps footnote/poetry/table plugins unaware of persistence entirely.

---

## 6. Persistence & navigation-guard implementation

- `AutosavePlugin`: on each `registerUpdateListener` firing (debounced ~500ms–1s),
  serialize `editorState.toJSON()`, plus the out-of-band footnote registry (§3.3), into
  one payload, and write to `localStorage["editor:draft:" + documentId]` with a
  timestamp.
- On mount: compare stored draft timestamp/hash against `initialContent`; if they
  differ, surface a restore-draft decision to the host (callback, not a hardcoded
  modal, so the host can style/place it) before initializing the editor with either the
  draft or `initialContent`.
- `NavigationGuardPlugin`: maintains a `dirty` boolean flipped on `registerUpdateListener`
  and cleared on a successful `onSave`. Exposes via editor ref:
  `hasUnsavedChanges(): boolean` and `confirmDiscard(): Promise<boolean>` (the latter
  invoking a host-supplied confirmation UI). Also wires `window.addEventListener
  ('beforeunload', ...)` automatically when `dirty` is true.
- Router-guard integration is documented as a recipe (React Router `useBlocker`, Vue
  Router `onBeforeRouteLeave`) calling `hasUnsavedChanges()`/`confirmDiscard()` — the
  editor cannot own this, since it doesn't know which router the host uses.

---

## 7. Language services architecture

- `LanguageServicesPlugin` does **not** run spellcheck/autocomplete logic itself — it
  spawns one long-lived Web Worker (`language-services/workers/spellcheck.worker.ts`
  etc.) per enabled capability and communicates via `postMessage`.
- Dictionaries are lazy-loaded: the worker only fetches the Hunspell `.aff`/`.dic` (or
  thesaurus dataset) for a language the document actually uses, detected from block-level
  `dir`/language metadata rather than loading all three languages up front.
- Flow: `registerUpdateListener` → debounce → post current plain-text projection (with
  node-id-tagged word offsets) to worker → worker returns a list of misspelled ranges →
  main thread applies them as non-content-mutating decorations (Lexical's `Mark`-style
  overlay, not `TextNode` mutation) so spellcheck never interferes with undo history.
- Autocomplete ghost-text is rendered as a transient decorator, discarded on next
  keystroke unless accepted — never inserted into the real `EditorState` until accepted.

---

## 8. Format conversion architecture

- `converters/*` packages are pure functions with no editor/React dependency:
  `serialize(editorState: SerializedEditorState, ctx) → string` and
  `parse(input: string, ctx) → SerializedEditorState`, where `ctx` carries things like
  the footnote registry and any host-supplied image-URL resolver.
- A single `FormatRegistry` (in `core/config`) maps `'markdown' | 'html' | 'plain-text'
  | 'lexical-json'` to its converter pair, so the public API's `getContent(format)` /
  `setContent(str, format)` is a thin dispatch, and adding a future format doesn't touch
  the editor component itself.
- Each converter owns its own **fidelity degradation rules** (§ fidelity matrix in the
  spec doc) as an explicit, tested table — e.g. plain-text serializer has a documented,
  unit-tested mapping for every node type, not an ad hoc `.textContent` walk.

---

## 9. Public API surface (React, primary)

```ts
interface EditorProps {
  documentId?: string;
  initialContent?: { format: FormatId; value: string };
  featureConfig?: EditorFeatureConfig;      // see spec §5
  theme?: MantineThemeOverride;
  locale?: 'en' | 'ur' | 'pa-shahmukhi';     // UI chrome language
  onChange?: (state: SerializedEditorState) => void;
  onSave?: (content: string, format: FormatId) => void;
  onImageUpload?: (file: File) => Promise<string>;
  onDraftConflict?: (draft: DraftMeta) => Promise<'restore' | 'discard'>;
}

interface EditorRef {
  getContent(format: FormatId): string;
  setContent(value: string, format: FormatId): void;
  hasUnsavedChanges(): boolean;
  confirmDiscard(): Promise<boolean>;
  focus(): void;
}
```

- Web Component maps this 1:1 (§ spec 9.3): primitive props → attributes, `theme`/
  `featureConfig` → element properties, callbacks → `CustomEvent`s, ref methods →
  methods on the custom element instance.

---

## 10. Suggested next step

With this architecture in place, the natural follow-ups are:
1. Lock the `EditorFeatureConfig` schema and `FormatRegistry` interfaces as actual
   TypeScript (they're the contracts everything else is built against).
2. Prototype `PoetryBlockNode` against real sample verse early (flagged as a risk in
   the spec) since it's the least conventional part of the schema.
3. Move to UI/visual design (toolbar layout, dialogs, default Mantine theme, RTL
   chrome) once you're ready for that pass.
