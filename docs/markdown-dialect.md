# Likhari Markdown dialect (draft)

Status: **draft, implemented in `packages/converters/src/markdown`** (Phase 2). It
follows ADR-0001 (a CommonMark/GFM superset built on `unified`/`remark`, using
`remark-directive` for everything GFM lacks) and `docs/lexical-editor-spec.md` §2.1.
This page is the written dialect the spec asks for; changing it changes what files
written by earlier versions mean, so treat it as versioned.

Not yet in the dialect, because the editor features do not exist yet (Phase 3):
columns, footnotes/endnotes (`[^fn:1]`), poetry containers. Appendices, ghazal
containers and the `renderer` package from ADR-0001 are likewise future work.

## 1. Base

CommonMark plus GFM (tables, task lists, strikethrough, autolinks). Output style:
`-` bullets, `*emphasis*`, `**strong**`, `---` rules, fenced code.

## 2. Inline directives

Attribute values are quoted: `{color="#f00"}`.

| Feature | Syntax | Notes |
|---|---|---|
| Bold, italic, strikethrough | `**x**`, `*x*`, `~~x~~` | GFM |
| Inline code | `` `x` `` | |
| Underline | `:u[x]` | |
| Superscript / subscript | `:sup[x]` / `:sub[x]` | |
| Highlight | `:mark[x]` | |
| Font, size, colour, background | `:span[x]{font="Amiri" size="20px" color="#f00" bg="#ff0"}` | Other CSS declarations round-trip verbatim in `style="…"` |
| Link | `[x](url "title")` | |
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

## 4. Import rules

- Unknown `:word` text directives and unknown `::leaf` directives are restored as
  literal text, so prose such as `10:30` is never swallowed. Unknown `:::containers`
  are transparent: their content is kept.
- Raw HTML blocks, link definitions and front matter are dropped.
- `javascript:` links and non-image `data:` URLs are removed; `style` / attribute
  values containing `;{}<>` in the dedicated attributes are dropped.
- Code fences become a paragraph of code-formatted text (the editor has no code block yet).
- Block images inside a paragraph are lifted out as block images.

## 5. Fidelity matrix

Round trip = editor → Markdown → editor.

| Content | Result |
|---|---|
| Paragraph text, headings, quotes, lists, tasks, nesting | lossless |
| Bold, italic, strikethrough, code, underline, sup/sub, highlight | lossless |
| Font family / size / colour / background | lossless (`:span`) |
| Links | URL, title and text kept; `rel` and `target` are not |
| Alignment (all six values), indent, forced direction | lossless |
| Inferred direction | not stored; recomputed from the text |
| Images | lossless; embedded images inline their whole base64 |
| Page break, rule | lossless |
| Tables | content, rows, columns kept. **Header state is not**: the first row becomes the header on import. Multiple blocks in a cell are joined with line breaks |
| Empty paragraphs | dropped (Markdown has no way to say them) |
| Code combined with bold/italic/etc. | kept (marks wrap the code span) |
| Unknown node types | text content kept as paragraphs |

## 6. Fallback rule

Anything the editor can hold but the dialect cannot express is **degraded to its
text**, never to a parse error, and is listed in the matrix above. (The spec's
HTML-comment fallback for preserving unrepresentable data is not used yet because
there is currently nothing the dialect cannot express that matters; revisit when
columns/poetry land.)
