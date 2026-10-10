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
| Alignment, indent, direction | `:::para{align="center" indent="2" dir="rtl"}` around one block, closed with `:::` |

`para` attributes: `align` is `left|right|center|justify|start|end` (`start`/`end`
are logical and flip with direction, spec §3); `indent` is a level count; `dir` is
`rtl|ltr`. `dir` is **only written when it differs from what a reader infers from
the first strong character**, so an Urdu paragraph in an Urdu document carries no
markup. The wrapper is omitted entirely when nothing needs saying.

An image whose source is a `data:` URI is imported as *embedded*, any other as *linked*.

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

A poetry block is one or more couplets (two-line verse units) sharing one layout,
written as a `:::poetry{...}` container. `layout` is always written; every other
attribute is only written when it differs from its default, so a plain couplet in
the default layout carries no attributes at all beyond `layout`.

| Attribute | Values | Default | Meaning |
|---|---|---|---|
| `layout` | `single`, `two-column`, `staggered` | — (always written) | How the couplets in this block are arranged |
| `spacing` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Vertical space between couplets |
| `gutter` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Horizontal space either side of the divider, `two-column` only |
| `stagger` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Width of each couplet's box, `staggered` only |
| `centerWidth` | `compact`, `normal`, `relaxed`, `loose` | `normal` | Width of a centered couplet, `two-column` only (§5.3) |
| `width` | a pixel number | unset | User-resized block width, from dragging the block's own resize handle |

### 5.1 Single-column and staggered

Both lay out a couplet's two misras (lines) as two plain paragraphs — the only
difference is the `layout` attribute itself, which drives the editor's CSS, not
the Markdown shape:

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
container, two per couplet, in order.

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

### 5.3 Centered couplet

A centered couplet (the toolbar's "Center this couplet", only available in
`two-column` layout) is a `:::columns{count="1"}` with a single `:::column`
holding both misras as two paragraphs, rather than two columns with one misra
each:

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

`centerWidth` is set on the whole `poetry` block, not per couplet — every
centered couplet in the same block shares it.

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
| Poetry: layout, spacing, gutter, stagger, centerWidth, width | lossless (§5) |
| Poetry: couplet pairing in two-column layout | lossless, via one `:::columns` per couplet (§5.2) |
| Empty paragraphs | dropped (Markdown has no way to say them) |
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
