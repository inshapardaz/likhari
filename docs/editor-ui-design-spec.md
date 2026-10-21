# UI / Visual Design Specification

Companion to `lexical-editor-spec.md` and `editor-architecture-design.md`. Reference
mockup: `editor-ui-mockup.html`.

---

## 1. Design principles

1. **The chrome recedes; the writing doesn't.** No card shadows on toolbar buttons, no
   loud accent color used for anything but the single most important action on screen
   (Save). The canvas is the hero, not the toolbar.
2. **RTL is a first-class layout mode, not a mirrored afterthought.** Every directional
   icon flips; script-appropriate fonts load per language; alignment defaults change —
   this is treated as a real mode switch, the same weight as a light/dark toggle, not a
   CSS `dir` attribute bolted on at the end.
3. **Poetry mode looks like a different kind of writing, because it is one.** A single
   reserved accent (plum) and one icon mark it as distinct, without turning the whole
   toolbar into a second theme.

---

## 2. Design tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#FFFFFF` | `#1B1B19` | Canvas / app background |
| `--paper-dim` | `#F5F5F5` | `#242422` | Toolbar / status bar background |
| `--ink` | `#1E1E1C` | `#EDEBE4` | Primary text |
| `--ink-soft` | `#5C5A54` | `#A6A398` | Secondary text, filenames, status |
| `--line` | `#DAD7CE` | `#3A3934` | Hairline dividers |
| `--line-strong` | `#BEBAAE` | `#4E4C45` | Input/select borders |
| `--accent` | `#2B6E6E` | `#6FBFBF` | Active state, Save button, links |
| `--accent-soft` | `#E4EFEE` | `#233333` | Active-button background wash |
| `--poetry` | `#6B4E71` | `#C79ECB` | Poetry-mode icon/badge only |
| `--danger` | `#B3462C` | `#E08A73` | Destructive actions, validation errors |

**Rationale for the palette**: deliberately avoided the two most common "generated UI"
tells — warm cream + terracotta, and near-black + acid accent. Teal-on-stone reads
calm and editorial (appropriate to a writing tool) without being a stock choice for one.

### Typography

| Role | Family | Notes |
|---|---|---|
| Chrome (toolbar, menus, dialogs, status bar) | IBM Plex Sans | One family for all UI, weights 400/500 only. |
| Canvas body — Latin script | IBM Plex Serif | A writing surface earns a manuscript feel; distinct from the sans chrome so users always know "this is content" vs "this is control." |
| Canvas body — Urdu / Punjabi (Shahmukhi) | Noto Nastaliq Urdu | Nastaliq needs ~30% more line-height than Latin serif at the same point size (see §4) — do not reuse Latin line-height values. |
| Headings (canvas) | Inherit canvas font, 600 weight | No separate display face — one voice per script is enough for a document editor. |

Two font sizes govern the toolbar itself: 15px icon glyphs, 12px labels/selects — no
third size. Canvas type scale is a separate, larger scale (§4) since it's reading
content, not UI chrome.

---

## 3. Toolbar layout

### 3.1 Grouping (left to right, LTR; mirrored as a whole unit in RTL — see §5)

1. **Block type** — paragraph/heading dropdown (H1–H6 + paragraph + quote as list
   items, not six separate buttons — six heading buttons would dominate the bar).
2. **Inline formatting** — bold, italic, underline, strikethrough.
3. **Script & cleanup** — superscript, subscript, clear formatting. (Uppercase/
   lowercase/capitalize live in this group's overflow submenu, not as top-level icons —
   they're used rarely enough that three more icons here would crowd the primary row;
   see §3.3.)
4. **Lists & quote** — bullet, numbered, checklist, quote.
5. **Alignment & indent** — start/center/end/justify, outdent/indent as one visual
   group since they're all about paragraph position.
6. **Color** — text color swatch, highlight swatch (native color inputs, not a custom
   picker, for v1 — a full palette picker is a dialog-level enhancement, not a toolbar
   requirement).
7. **Insert** — link, image, table, columns, footnote.
8. **Poetry** (conditionally rendered — only shown when `config.poetry.enabled` **and**
   the active language is Urdu/Punjabi; hidden entirely for English-only documents
   rather than grayed out, per the config system in the architecture doc).
9. **History** — undo, redo.
10. **Save** — right-aligned (logical "end"), the one filled/accent button in the
    toolbar, per the "one accent per view" restraint principle.

Font family/size selectors, background/foreground beyond the quick swatches, and page
break are **overflow-menu items** (a "more" `...` button at the end of the bar) rather
than permanent icons — they're configured per-document more often than toggled
per-selection, so they don't need primary-row real estate.

In `fontMode="uniform"` the font-size selector is replaced by a **zoom** control laid out
`[−] 100% [+]`, in the right-aligned end cluster beside the drafts and search buttons
(the single font-family selector stays in the font group). − and + step through the
preset levels (50–300 %) and are disabled at the ends; the percentage button resets to
100 %. Zoom is a view control: it scales the whole canvas uniformly, so it never changes
per selection. The control is always laid out left-to-right (− on the left), like a
number, even in RTL.

### 3.2 Sizing & spacing

- Toolbar height: 46px. Button hit target: 30×30px (meets touch-target minimums with
  room for 8px gaps).
- Dividers between groups: 0.5px hairline, not a visible gap alone — gaps read as
  accidental spacing, hairlines read as intentional grouping.
- Active/toggled state (e.g. bold is on): `--accent-soft` background + `--accent` icon
  color. Never a border-only "active" state — too subtle at 30px.

### 3.3 Responsive collapse

- **Desktop (>900px)**: all groups visible per §3.1.
- **Tablet (600–900px)**: groups 3 (script/cleanup) and 6 (color) collapse into the
  overflow menu first — they're the least frequently used at a glance.
- **Mobile (<600px)**: only groups 1, 2, 5, 9, 10 remain on the primary row (block type,
  bold/italic/underline, alignment, undo/redo, save); everything else moves to a single
  "..." overflow sheet. Toolbar becomes horizontally scrollable as a fallback if a host
  disables enough features that the remaining set still overflows a narrow viewport.

### 3.4 Ribbon layout (alternative to §3.1 and §3.3)

An opt-in layout, `toolbarStyle.layout: 'ribbon'`, for hosts that want an office-style bar.
**It does not replace the classic toolbar**: §3.1 and §3.3 stay the default and still describe
it. The ribbon has the same commands and the same configuration toggles, regrouped:

- **Tab strip** (a `tablist`): Home, Insert, Tools, View, then any context tabs. Two groups sit on the
  same row but are on no tab, so they stay in reach on every tab and when there are no tabs at all:
  **quick access** (save, undo, redo) before the tabs, and **document tools** (drafts, search/find and
  replace, help) after them, each its own named toolbar. Their buttons are flat icons: no border or
  background at rest (hover tints them); an open state (search) is an accent icon with a short bar
  under it, and unsaved changes on Save an accent icon with a dot, rather than the classic toolbar's
  filled Save. In RTL (§5) the row mirrors as a whole.
- **Command row**: the selected tab's groups, in the §3.2 sizes (46px row, 30×30px buttons,
  hairline dividers). It never wraps and never collapses into a "..." menu; on a narrow screen it
  scrolls sideways, and so does the tab strip.
- **Home**: block type, inline formatting (with its more-formatting menu), alignment and indent,
  font family and size. **Insert**: link, image, rule, table, columns, footnote, page break, poetry
  couplet. **Tools**: auto-correct, correct whole document, spell check, join lines.
  **View**: zoom (uniform font mode only).
- **Context tabs** (Table, Poetry, Link) are added after View only while the caret is in that
  kind of content, tinted with `--accent-soft` so they read as appearing because of the caret. They
  show the commands the classic toolbar keeps in its table, poetry and link menus, as buttons. They
  never select themselves; if one is selected when the caret leaves, the first tab is selected.
- A tab with no commands (features off, or no context) is not shown.
- **Collapse**: a chevron at the end of the row (the last button of the document tools), a double-click
  on a tab, or Ctrl+F1 hides the command row, leaving the tab row closed off with a hairline. Collapsed,
  no tab is selected; clicking a tab peeks its commands in a panel laid over the canvas (no reflow,
  with a shadow), which closes on a second click of that tab, Escape, a click outside the ribbon, or a
  chosen command, but not while a dropdown or menu opened from it is in use. Arrow keys move between
  tabs without opening them; Enter/Space opens. Only offered when there are tabs.
- **Narrow editors**: below 560px of editor width (a container query, not the window's) the tabs drop
  to a line of their own beneath the quick-access and document-tool groups, instead of being squeezed
  out of the row.
- Selected tab: `--accent` text with a 2px `--accent` underline, the same restraint as §3.2's
  one-accent rule. Clicking a tab does not move focus out of the editor.
- RTL (§5): the strip and row mirror as a whole, arrow-key direction reverses, and the tab names
  are translated.

Keyboard: the tab list has one tab stop (the selected tab); ArrowLeft/ArrowRight, Home and End
move between tabs and select them.

---

## 4. Canvas typography scale

| Element | Latin (IBM Plex Serif) | Urdu/Punjabi (Noto Nastaliq Urdu) |
|---|---|---|
| Body | 15px / 1.75 line-height | 20px / 2.3 line-height |
| H1 | 1.8em / 600 | 1.8em / 600 |
| H2 | 1.5em / 600 | 1.5em / 600 |
| H3–H6 | 1.3–1.05em / 600 | 1.3–1.05em / 600 |
| Poetry couplet | 15px / 1.6, own margin rhythm (see poetry spacing below) | 20px / 2.1 |

Nastaliq is rendered noticeably larger and looser than the Latin serif at the same
nominal "body text" role — this isn't a stylistic flourish, it's necessary for the
script's diacritics and descenders not to collide between lines. Do not let a single
shared `font-size`/`line-height` variable drive both scripts.

**Poetry-specific spacing**: single-column couplets get a visible paragraph gap between
each pair (per the spec's "paragraph break between couplets" requirement) — implement
as `margin-block-end: 1.4em` on the couplet block, distinct from ordinary paragraph
spacing (`1em`), so verse reads as visually separated units even before a reader
processes the content.

---

## 5. RTL mirroring rules

Not everything flips — this is the part most naive RTL implementations get wrong.

**Mirrors (physical meaning is direction-relative):**
- Align start/end icons swap glyphs (start = right-pointing lines in RTL).
- Indent/outdent icons swap direction of the arrow/chevron.
- The toolbar's own group order does **not** need to reverse — keep block-type first,
  save last, regardless of document direction; only the *icons whose meaning is
  inherently directional* flip, not the whole bar's layout. (The mockup demonstrates
  this: bold/italic/underline stay in the same left-to-right toolbar position in both
  language modes, because "bold" has no direction — only align/indent icons change.)
- Canvas text alignment default switches from `start` (visually left) to `start`
  (visually right) — because it's stored as a logical value, the document author never
  has to manually re-align when switching languages mid-document.

**Does not mirror:**
- Bold/italic/underline/strikethrough/superscript/subscript icons — these represent a
  property of the text, not a spatial direction.
- Undo/redo icons — convention (counterclockwise = undo) is stable across scripts;
  flipping them would confuse users familiar with any other software.
- Numbers, list markers, and footnote markers — decide explicitly per §3.2 of the
  requirements doc (Eastern Arabic-Indic vs. Latin numerals) but do not mirror digit
  order within a number.

---

## 6. Dialogs

Link, image, table-insert, and poetry-conversion dialogs share one modal pattern:

- Centered overlay, `--paper` surface, 12px radius, 0.5px border (no shadow-heavy
  elevation — consistent with the flat aesthetic).
- Title in chrome sans, 500 weight, sentence case ("Insert link", not "Insert Link" or
  "INSERT LINK").
- Primary action button uses `--accent` fill (the one accent-per-view rule applies
  inside dialogs too — a dialog with both "Insert" and a colored "Cancel" would violate
  it; Cancel stays a plain outline/ghost button).
- Dialog text direction follows the **document's** current direction, not the browser
  locale — a link dialog opened while editing an Urdu paragraph should itself read RTL,
  since the user's hands are already in that mode.
- Image dialog specifically: tabs (or a segmented control) for "Link" vs. "Upload",
  plus a caption field always visible below the preview once an image is chosen —
  captions shouldn't be a separate hidden step.

---

## 7. States

| State | Treatment |
|---|---|
| Hover (toolbar button) | Background → `--line` |
| Active/toggled (e.g. bold applied) | Background → `--accent-soft`, icon → `--accent` |
| Disabled (feature off via config) | Not rendered at all (see architecture doc §2 — config controls availability, not a grayed-out button) |
| Focus (keyboard) | 2px `--accent` outline, offset 1px — never rely on color change alone |
| Save button, unsaved changes | Filled `--accent`; reverts to outline style immediately after a successful save (so "saved" has a visibly different resting state, not just a toast) |

---

## 8. Mapping to Mantine (headless)

- Toolbar buttons → Mantine `UnstyledButton` + the tokens above via CSS variables,
  rather than Mantine's default `Button` visual styles.
- Dropdowns (block type, overflow menu) → Mantine `Menu` (headless), styled with the
  same tokens.
- Dialogs → Mantine `Modal` (headless) for focus-trapping/escape-key/overlay behavior,
  restyled per §6.
- Color swatches → Mantine `ColorInput` in "swatches" mode, restricted to a small
  curated palette by default with an "custom" option, rather than a full color wheel by
  default (keeps the toolbar-level control lightweight; power users can go custom).
- Theme object exposes these tokens as CSS custom properties at the root
  (`--editor-accent`, etc.) so a host overriding the Mantine theme doesn't have to touch
  component code — consistent with the "headless + default theme" requirement.

---

## 9. Open items for a future pass

- Table-insert dialog's row/column picker (grid-hover selector) — not mocked yet.
- Footnote panel layout (inline popover vs. persistent sidebar) — needs a decision
  before implementation, since it affects canvas width on wide screens.
- Mobile touch toolbar — the responsive collapse rules in §3.3 are specified but not
  yet mocked at a real 375px viewport.
