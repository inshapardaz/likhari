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

> Simplified sketch — the shipped node (`packages/react/src/blocks/PoetryNode.tsx`)
> additionally carries `width`, `spacing`, `gutter`, `stagger` and `centerWidth`
> (per-instance scales for couplet spacing/two-column gutter/staggered box
> width/centered-couplet width) that predate this amendment and were never added
> here; `align` was never implemented (poetry text is always CSS-justified). The
> `autoWidth` attribute, plus `stagger`'s own `staggerGroup` companion, are this
> amendment's addition. An earlier revision of this amendment added `musaddas`/
> `mukhammas` as a second, orthogonal `form` attribute; that was folded back into
> `layout` itself (see below) once the toolbar exposed all five choices as one
> flat list, since `form` and `layout` together only ever produced 5 valid
> combinations out of 9 (`two-column`/`staggered` were always `form: 'couplet'`).
> `stanzaVariant` is a later, independent addition — a sub-choice *within* a
> musaddas/mukhammas stanza, not another layout axis, so it never grows the
> `layout` enum the way `form` almost did.

```ts
// Single flat set, not a layout × stanza-size pair: single/two-column/staggered
// are 2-line couplets; musaddas (6) and mukhammas (5) render the same flat
// single-column shape 'single' does, just with a larger stanza.
type PoetryLayout = 'single' | 'two-column' | 'staggered' | 'musaddas' | 'mukhammas';
const POETRY_STANZA_SIZE: Record<PoetryLayout, number> =
  { single: 2, 'two-column': 2, staggered: 2, musaddas: 6, mukhammas: 5 };

// Secondary grouping within a musaddas/mukhammas stanza — meaningless (always
// 'continuous') for the other three layouts. 'continuous' is today's flat
// rendering; 'split' is the same flat shape plus a CSS-only secondary divider
// before the stanza's last 2 lines; 'mixed' is a real shape change — the
// stanza's first 4 misras become 2 two-column rows, the rest stay flat.
type PoetryStanzaVariant = 'continuous' | 'split' | 'mixed';

class PoetryBlockNode extends ElementNode {
  __layout: PoetryLayout;
  __width?: number; // user-dragged, single-column-shaped layouts only
  __autoWidth: boolean; // fit-content instead of __width; single-column-shaped
                         // layouts only (single/musaddas/mukhammas), mutually
                         // exclusive with __width (forced false when `layout`
                         // changes to 'two-column'/'staggered')
  __staggerGroup: 1 | 2; // couplets sharing one side before 'staggered' flips
  __stanzaVariant: PoetryStanzaVariant; // musaddas/mukhammas only; forced back
                                        // to 'continuous' when `layout` changes
                                        // away from them
  // children: for 'continuous'/'split' (and single/two-column/staggered,
  // which are always 'continuous'), POETRY_STANZA_SIZE[layout] ParagraphNode
  // misras stacked flat per stanza; for 'two-column' layout, a
  // LayoutContainerNode with two LayoutItemNodes (one misra each) per couplet
  // (see §4 note on composition); for a 'mixed' stanza, 2 such
  // LayoutContainerNode rows (the stanza's first 4 misras) followed by
  // POETRY_STANZA_SIZE[layout] - 4 flat ParagraphNode misras — poetryActions.ts's
  // $getCouplets is the one place that reads any of these three physical
  // shapes back into a uniform per-stanza misra array, and $buildCoupletNodes
  // is the one place that builds any of them.
}
```

- `setLayoutAttribute()` mutates the node in place (same node identity, different
  rendering) so converting a stanza between layouts doesn't require
  deleting/recreating it and losing selection/undo coherence — the actual child
  restructuring (regrouping paragraphs into the new stanza size or column shape)
  is a `$`-prefixed tree operation (`$setPoetryLayout`) in `poetryActions.ts`, not
  a node method. Since a layout change can also change the stanza size now
  (e.g. `single` → `musaddas`), `$setPoetryLayout` flattens every misra across the
  block's current stanzas and re-chunks that flat sequence into groups of the
  target layout's stanza size, padding the last group with empty paragraphs if
  it falls short — a transition that doesn't change stanza size (any
  single/two-column/staggered pairing) is just a special case of the same
  re-chunking, since the group size doesn't change.
- A document is a sequence of `PoetryBlockNode`s (and ordinary paragraphs, for prose
  interleaved with verse) — this directly satisfies all four poetry templates in the
  spec, plus musaddas/mukhammas, as instances of one `layout` enum, rather than
  fixed node types per template.

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

The component prop `fontMode="uniform"` swaps the font family/size controls for a single
editor-wide font plus a zoom control. This is deliberately **not** document state: no
nodes or styles are written. `EditorRoot` holds `{ fontFamily, zoom }` and exposes them
to the canvas as `data-font-mode` / `data-uniform-font` attributes and the
`--likhari-uniform-font` / `--likhari-zoom` CSS custom properties; `editor.css` does the
rest. That keeps exports unchanged and the font nodes registered either way, in line with
the rule that config toggles availability, not schema.

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
| `FontColorPlugin` | font family/size/color pickers (font family + zoom when `fontMode="uniform"`) | `config.font`, `config.color` |
| `LinkPlugin` | `@lexical/link` + dialog | `config.links` |
| `ImagePlugin` | `ImageNode` insert UI, upload handler wiring | `config.images.*` |
| `TablePlugin` | `@lexical/table` | `config.tables` |
| `LayoutPlugin` | columns insert UI | `config.columns` |
| `FootnotePlugin` | `FootnoteReferenceNode` insert, renumbering, `FootnoteListPlugin` | `config.footnotes` |
| `PoetryPlugin` | poetry insert menu, per-couplet layout toggle UI | `config.poetry.*` |
| `FindReplacePlugin` | search overlay, match navigation | `config.findReplace` |
| — (`Toolbar`'s own handler, no separate plugin) | Join lines: toolbar button and right-click menu item | `config.joinLines` |
| `DraggableBlockPlugin` | Drag grip beside the hovered block to move it; inside a poetry block, a grip to move the whole stanza (couplet, or musaddas'/mukhammas' larger stanza — into any poetry block, rebuilt for that block's own layout, or out as a new one) and a grip to swap the line with another | `config.dragBlocks` |
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
