# Likhari Markdown dialect

Status: **implemented in `packages/converters/src/markdown`**. It follows ADR-0001
(a CommonMark/GFM superset built on `unified`/`remark`, using `remark-directive` for
everything GFM lacks) and `docs/lexical-editor-spec.md` §2.1. This page is the
written dialect the spec asks for; changing it changes what files written by
earlier versions mean, so treat it as versioned.

Appendices, ghazal containers and the `renderer` package from ADR-0001 are not
implemented.

Every example on this page is real output from `markdownConverter.serialize()`,
not hand-written — if the converter's output ever changes, this page is wrong
until it's updated to match.

## 1. Base

CommonMark plus GFM (tables, task lists, strikethrough, autolinks, footnotes).
Output style: `-` bullets, `*emphasis*`, `**strong**`, `---` rules, fenced code.

## 2. Inline directives

Attribute values are quoted: `{color="#f00"}`.

| Feature | Syntax | Notes |
|---|---|---|
| Bold, italic, strikethrough | `**x**`, `*x*`, `~~x~~` | GFM |
| Inline code | `` `x` `` | |
| Underline | `:u[x]` | |
| Superscript / subscript | `:sup[x]` / `:sub[x]` | |
| Highlight | `:mark[x]` | |
| Colour, background | `:span[x]{color="#f00" bg="#ff0"}` | Other CSS declarations round-trip verbatim in `style="…"`. Font family and size are not part of the dialect — see §9 |
| Link | `[x](url "title")` | |
| Footnote reference | `[^1]` | plain GFM, not a directive — see §6 |
| Line break | backslash + newline | |

Nesting is allowed: `**bold *both***`. Spaces at the edge of formatted text are
written outside the markers, so `**x**` always hugs its text.

## 3. Block syntax

| Feature | Syntax |
|---|---|
| Heading | `# …` to `###### …` |
| Quote | `> …` |
| Lists | `-`, `1.` (start number kept), `- [ ]` / `- [x]`, nesting by indentation |
| Rule | `---` |
| Table | GFM pipe table; first row is the header |
| Image | `![alt](url)` |
| Image with caption or size | `::figure[Caption]{src="url" alt="…" width="320" height="200"}` |
| Page break | `::pagebreak` |
| Empty paragraphs at the end of the document | `::blank`, one per paragraph (see below) |
| Alignment, indent, direction | `:::para{align="center" indent="2" dir="rtl"}` around one block, closed with `:::` |

`para` attributes: `align` is `left|right|center|justify|start|end` (`start`/`end`
are logical and flip with direction, spec §3); `indent` is a level count; `dir` is
`rtl|ltr`. `dir` is **only written when it differs from what a reader infers from
the first strong character**, so an Urdu paragraph in an Urdu document carries no
markup. The wrapper is omitted entirely when nothing needs saying.

An image whose source is a `data:` URI is imported as *embedded*, any other as *linked*.

**Empty paragraphs at the end.** Markdown cannot say an empty paragraph (a blank line only
separates paragraphs), so empty paragraphs are normally dropped on export. The exception is a
run of them at the **end of the document**, which marks where the last paragraph of a page ends
(`mergePages` with `joinParagraphs: 'blank-line'` reads it that way). Each is written as a
`::blank` line, after the body and before any footnote definitions, and read back as one empty
paragraph. A document that is nothing but empty paragraphs exports as empty text. `::blank` is a
dialect construct like `::pagebreak`: a renderer that does not know the directives shows it as
plain text.

## 4. Columns

```markdown
::::columns{count="2"}
:::column
left column text
:::

:::column
right column text
:::
::::
```

One `:::column` container per column, wrapped in one `::columns{count="N"}`
container; `count` is redundant with the number of `column` children (kept for
readability) and is not read back on import — the number of `:::column`
containers found is what counts. Columns are always equal width. A `:::column`
with no content of its own is not written.

The fence length (how many colons) grows with nesting depth — `remark-stringify`
picks the shortest fence that cannot be confused with the content inside it, so a
top-level `columns` needs four colons around a three-colon `column`, but the same
structure needs five and four when it is itself nested inside something else (see
the two-column poetry examples in §5).

## 5. Poetry

A poetry block is one or more stanzas sharing one layout, written as a
`:::poetry{...}` container. `layout` is always written; every other attribute is
only written when it differs from its default, so a plain single/two-column/staggered
couplet in the default layout carries no attributes at all beyond `layout`.

| Attribute | Values | Default | Meaning |
|---|---|---|---|
| `layout` | `single`, `two-column`, `staggered`, `musaddas`, `mukhammas` | — (always written) | How the stanzas in this block are arranged, and (for `musaddas`/`mukhammas`) its stanza size — 6/5 misra lines instead of the other three's 2 (requirements doc §4.11, amended) |
| `spacing` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Vertical space between stanzas |
| `gutter` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Horizontal space either side of the divider, `two-column` only |
| `stagger` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Width of each couplet's box, `staggered` only |
| `staggerGroup` | `1`, `2` | `1` | Couplets sharing one side before `staggered` flips |
| `centerWidth` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Width of a centered couplet (`two-column`), or a centered trailing line (`mukhammas`, `stanzaVariant: 'mixed'` only) (§5.3) |
| `width` | a pixel number | unset | User-resized block width, from dragging the block's own resize handle. Mutually exclusive with `autoWidth` |
| `autoWidth` | `true` | unset (`false`) | Fit-content width instead of a percentage/pixel max-width; `single`/`musaddas`/`mukhammas` layouts only |
| `stanzaVariant` | `continuous`, `split`, `mixed` | `continuous` | Secondary grouping within each stanza, `musaddas`/`mukhammas` only (requirements doc §4.11, amended) — see §5.1.1 |

### 5.1 Single-column and staggered

Both lay out a stanza's misras (lines) as plain paragraphs — the only difference
is the `layout` attribute itself, which drives the editor's CSS, not the
Markdown shape:

```markdown
:::poetry{layout="single"}
hum ne socha tha ke milenge

ab kahan mumkin hai yeh milna
:::
```

```markdown
:::poetry{layout="staggered" spacing="loose" stagger="relaxed"}
line a

line b

line c

line d
:::
```

A block with more than one couplet is just more paragraphs in the same
container, two per couplet, in order — the same is true for a `musaddas`
(6 lines per stanza) or `mukhammas` (5) block, just with a larger paragraph
group per stanza, written with `layout` set directly to `musaddas`/`mukhammas`
(the same flat single-column shape `single` uses, just a bigger stanza):

```markdown
:::poetry{layout="musaddas"}
line one

line two

line three

line four

line five

line six
:::
```

#### 5.1.1 Stanza variant (`musaddas`/`mukhammas` only)

`stanzaVariant` adds a secondary grouping inside each stanza, on top of the
flat paragraph list above:

- `continuous` (default): exactly the shape above — one divider at the
  stanza boundary only.
- `split`: the same flat paragraph shape (no change to the Markdown at
  all — it's a CSS-only rendering difference), but with an extra attribute
  marking a lighter secondary divider before the stanza's last two lines
  (musaddas 4+2, mukhammas 3+2):

```markdown
:::poetry{layout="musaddas" stanzaVariant="split"}
line one

line two

line three

line four

line five

line six
:::
```

- `mixed`: a real shape change — the stanza's first 4 lines become 2
  `:::columns{count="2"}` rows (exactly like a `two-column` couplet, §5.2),
  and the remaining `musaddas`: 2, `mukhammas`: 1 lines stay flat paragraphs
  directly after them, inside the same `:::poetry` container:

```markdown
:::::poetry{layout="musaddas" stanzaVariant="mixed"}
::::columns{count="2"}
:::column
line one
:::

:::column
line two
:::
::::

::::columns{count="2"}
:::column
line three
:::

:::column
line four
:::
::::

line five

line six
:::::
```

On import, a `:::poetry{layout="musaddas"|"mukhammas"}` container reads its
children generically by their own type — a `:::columns` child becomes part
of the 2-column section, a plain paragraph becomes part of the trailing flat
section — rather than needing a dedicated mixed-shape syntax, so this is
exactly the same `:::columns`-per-row approximation §5.2 already uses, just
limited to the stanza's first 4 lines.

`mukhammas`'s single trailing line (unlike `musaddas`'s 2) can additionally be
centered/narrowed the same way a `two-column` couplet can (§5.3) — written as
a `:::columns{count="1"}` with one `:::column` in place of the plain trailing
paragraph:

```markdown
:::::poetry{layout="mukhammas" stanzaVariant="mixed"}
::::columns{count="2"}
:::column
line one
:::

:::column
line two
:::
::::

::::columns{count="2"}
:::column
line three
:::

:::column
line four
:::
::::

::::columns{count="1"}
:::column
line five
:::
::::
:::::
```

### 5.2 Two-column

Each couplet is one row, and a row is written with the same `:::column`
primitive as the general Columns feature (§4) — a couplet's two misras are two
columns:

```markdown
:::::poetry{layout="two-column" gutter="loose"}
::::columns{count="2"}
:::column
right misra
:::

:::column
left misra
:::
::::
:::::
```

This is an approximation, not a dedicated poetry-row syntax: on import, a
`:::poetry{layout="two-column"}` container's `:::columns` children become the
block's couplets, one couplet per `columns` container, in order. A block with
several couplets repeats the `::::columns{count="2"}` ... `::::` structure once
per couplet, directly one after another inside the one `:::::poetry` container.

### 5.3 Centered couplet (and centered mukhammas-mixed trailing line)

A centered couplet (the toolbar's "Center", available in `two-column`
layout) is a `:::columns{count="1"}` with a single `:::column` holding both
misras as two paragraphs, rather than two columns with one misra each:

```markdown
:::::poetry{layout="two-column" centerWidth="relaxed"}
::::columns{count="1"}
:::column
misra 1

misra 2
:::
::::
:::::
```

The same toolbar toggle is also available in a `mukhammas` block with
`stanzaVariant: 'mixed'`, for its single trailing line only (`musaddas`'s 2
trailing lines are out of scope) — written the same way, just with one
misra in the `:::column` instead of two (§5.1.1 shows the full block).

`centerWidth` is set on the whole `poetry` block, not per couplet/line —
every centered couplet or centered trailing line in the same block shares
it.

## 6. Footnotes

Plain GFM, not a directive:

```markdown
A claim that needs a source.[^1]

[^1]: The source.
```

The footnote list (every `[^id]: ...` definition) is collected into one group at
the end of the document, regardless of where the definitions appear in the
source Markdown.

## 7. Import rules

- Unknown `:word` text directives and unknown `::leaf` directives are restored as
  literal text, so prose such as `10:30` is never swallowed. Unknown `:::containers`
  are transparent: their content is kept.
- Raw HTML blocks, link definitions and front matter are dropped.
- `javascript:` links and non-image `data:` URLs are removed; `style` / attribute
  values containing `;{}<>` in the dedicated attributes are dropped.
- Code fences become a paragraph of code-formatted text (the editor has no code block yet).
- Block images inside a paragraph are lifted out as block images.

## 8. Fidelity matrix

Round trip = editor → Markdown → editor.

| Content | Result |
|---|---|
| Paragraph text, headings, quotes, lists, tasks, nesting | lossless |
| Bold, italic, strikethrough, code, underline, sup/sub, highlight | lossless |
| Colour / background | lossless (`:span`) |
| Font family / size | **dropped** — not part of the dialect, by design (keeps Markdown close to plain GFM) |
| Links | URL, title and text kept; `rel` and `target` are not |
| Alignment (all six values), indent, forced direction | lossless |
| Inferred direction | not stored; recomputed from the text |
| Images | lossless; embedded images inline their whole base64 |
| Page break, rule | lossless |
| Tables | content, rows, columns kept. **Header state is not**: the first row becomes the header on import. Multiple blocks in a cell are joined with line breaks |
| Columns | lossless (§4) |
| Footnotes | lossless; references and definitions re-pair by id |
| Poetry: layout, spacing, gutter, stagger, staggerGroup, centerWidth, width, autoWidth | lossless (§5) |
| Poetry: couplet pairing in two-column layout | lossless, via one `:::columns` per couplet (§5.2) |
| Poetry: musaddas/mukhammas stanza grouping | lossless, grouped by `layout`'s own stanza size on import (§5.1) |
| Poetry: stanzaVariant (continuous/split/mixed) | lossless, including a `mixed` stanza's `:::columns` + flat-paragraph shape (§5.1.1) |
| Empty paragraphs at the end of the document | lossless, as `::blank` |
| Empty paragraphs elsewhere | dropped (Markdown has no way to say them; a blank line is just a paragraph separator) |
| Code combined with bold/italic/etc. | kept (marks wrap the code span) |
| Unknown node types | text content kept as paragraphs |

## 9. Fallback rule

Anything the editor can hold but the dialect cannot express is **degraded to its
text**, never to a parse error, and is listed in the matrix above. Font family and
size are the current example: a run styled with either loses that styling on
export, keeping any other formatting (bold, colour, …) it also carries — it is a
deliberate choice, not a `remark`/`unified` limitation, so that Markdown output
stays close to plain GFM rather than growing its own styling dialect. The spec's
HTML-comment fallback for preserving unrepresentable data is not used for this,
since the loss is intentional, not accidental.
