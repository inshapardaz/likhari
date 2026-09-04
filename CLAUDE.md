# Project: multilingual rich-text editor (Lexical-based)

This repo implements a configurable rich-text editor built on
[Lexical](https://lexical.dev/), supporting English, Urdu, and Punjabi
(Shahmukhi), with import/export across Markdown, HTML, plain text, and
Lexical JSON. It ships as a React component, a Vue wrapper, and a Web
Component wrapper.

Three design documents in `docs/` are the source of truth — read the
relevant one(s) before implementing any feature area, rather than guessing
at behavior. A reference UI mockup is in `mockups/`.

## Read these before starting work

- `docs/lexical-editor-spec.md` — **requirements**: full feature list, file
  format fidelity matrix, the extended Markdown dialect decision, and the
  phased rollout plan (§13). Read this first for *what* to build and *why*.
- `docs/editor-architecture-design.md` — **technical architecture**: package
  layout, custom Lexical node schemas (poetry, footnote, layout, page
  break, image), plugin system, data flow, persistence, and the public
  component API. Read this before writing any node, plugin, or converter
  code — it defines the contracts (`EditorFeatureConfig`, `FormatRegistry`,
  `EditorRef`) everything else is built against.
- `docs/editor-ui-design-spec.md` — **visual/UX design**: design tokens,
  toolbar grouping and responsive collapse rules, RTL mirroring rules
  (which icons flip and which don't), dialog patterns, and the Mantine
  theming mapping. Read this before building any toolbar, dialog, or
  themed component.
- `mockups/editor-ui-mockup.html` — open directly in a browser. Reference
  implementation of the toolbar + canvas, with working English/Urdu and
  light/dark toggles, demonstrating the RTL mirroring rules from the UI
  spec in practice.

## How to use these docs while implementing

- Treat `EditorFeatureConfig` (architecture doc §5 in the requirements /
  §9 in the architecture doc) as the contract every plugin must respect:
  a feature's toggle controls *toolbar/insert availability*, not node
  registration — all custom node types stay registered regardless of
  config (architecture doc §2). Get this distinction right early; it's
  called out explicitly because it's an easy place to introduce bugs.
- Follow the phasing in the requirements doc (§13) unless told otherwise:
  core English editing first, then Urdu/Punjabi + BiDi + Markdown/HTML,
  then columns/footnotes/poetry, then language tooling, then the
  Vue/Web Component wrappers.
- The known open risks are listed in the requirements doc (§12) —
  Punjabi Shahmukhi dictionary availability, the extended Markdown
  dialect spec, table cell merge scope, and the poetry node design.
  Flag back to the user if implementation reveals these are bigger
  blockers than scoped.
- When a design decision in code seems to contradict one of these docs,
  say so explicitly rather than silently diverging — the docs are the
  agreed spec, not just background reading.

## Repo layout (to be created)

```
docs/                  # the three spec documents (already present)
mockups/               # UI reference mockup (already present)
packages/
  core/                # framework-agnostic nodes, plugins, config, theme
  react/               # primary React implementation
  converters/           # markdown / html / plain-text / lexical-json
  language-services/    # spellcheck / thesaurus / autocomplete workers
  webcomponent/
  vue/
```

See `docs/editor-architecture-design.md` §1 for the full rationale behind
this split (in particular, why `core` must stay React-free).
