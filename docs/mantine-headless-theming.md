# Mantine Headless Mode, Default Theme, and Extension Guide

**Status: proposed design, partially implemented.** Migration plan (§8) step 1
is done (peer dependencies, CSS import boundary, `styles.css` export) and
step 4's portal/CSS-variable scoping to the editor root (§4 rule 3) landed as
part of other work. Steps 2, 3, 5 (headless hooks layer, Styles API rebuild,
`unstyled`/`classNames`/`styles`/`components`/`toolbar` props) are not started
— see the open questions in §9, which need a decision before that work begins.
It is the spec for the GitHub issue "Migrate UI to Mantine headless mode with
a default out-of-the-box theme".

Related spec sections: `lexical-editor-spec.md` §10 (Theming),
`editor-ui-design-spec.md` §8 (Mapping to Mantine), and
`editor-architecture-design.md` §1 and §9 (`theme` prop on `EditorRoot`).

The design borrows its Mantine integration model from
[qari](https://github.com/inshapardaz/qari), the sibling EPUB reader, which
already solves the same problems (nested providers, scoped CSS variables,
fullscreen portals, host theme inheritance). Where qari's choices apply
unchanged this doc says so; where likhari differs, it says why.

---

## 1. Current state

Phase 1 already depends on Mantine, but not in the way the specs describe:

| Area | Spec says | Code today |
|---|---|---|
| Dependency | Peer-style, host controls version | ✅ Done — `@mantine/core`/`@mantine/hooks` are `peerDependencies` of `packages/react` |
| Global CSS | Host controls load order | ✅ Done — `EditorThemeProvider` no longer imports `@mantine/core/styles.css`; the package exports its own `@inshapardaz/likhari-react/styles.css` |
| Headless | Toolbar buttons are `UnstyledButton`, menus and modals are headless (UI spec §8) | Not started — toolbar is hand-built; only `MantineProvider` and the theme object are used. No consumer-facing way to swap or restyle parts |
| Theme override | `theme` prop deep-merges over the default | Partial — only `theme.colors` shallow-merges over the default (for the `accentColor` prop); other top-level theme fields still replace rather than merge |
| Tokens | `--editor-*` CSS variables are the styling contract | ✅ Done (`packages/core/src/theme`), scoped per editor instance (not just `.likhari-theme-scope` globally — see §4 rule 3, also done) |

The migration closes these gaps rather than starting over.

## 2. Goals and non-goals

Goals:

1. **Flexible.** A host can restyle any part of the editor UI, replace
   individual controls, or build a whole custom toolbar, without forking.
2. **Works with zero configuration.** `<EditorRoot />` looks finished with no
   theme prop and no extra CSS beyond one stylesheet import.
3. **Documented extension points**, each with a stable, versioned contract.
4. **Same styling contract for non-React hosts** (Web Component, Vue wrapper)
   via CSS custom properties.

Non-goals: replacing Mantine with another library, and theming the *document
content* (that is governed by the type scale in UI spec §4 and the per-script
fonts; content theming stays in `--editor-*` tokens).

## 3. Layered architecture

```
┌──────────────────────────────────────────────────────────┐
│ 3. Default theme      (opt-out)  styled toolbar, dialogs │
│    built from layer 2 + Mantine theme + --editor-* tokens│
├──────────────────────────────────────────────────────────┤
│ 2. Headless UI layer  (stable)   slot components with    │
│    Styles API (classNames/styles), `unstyled`, overrides │
├──────────────────────────────────────────────────────────┤
│ 1. Headless behavior  (stable)   hooks + commands:       │
│    useToolbarState, useBlockType, useFormatToggle, ...   │
│    no markup, no Mantine imports                         │
└──────────────────────────────────────────────────────────┘
```

- **Layer 1** exposes editor state and actions as hooks (`useFormatState`,
  `useBlockType`, `useAlignment`, `useHistoryState`, dialog controllers). It
  contains all Lexical command wiring and no JSX. Anyone can build a UI on it.
- **Layer 2** is the Mantine-based component set (`Toolbar`, `ToolbarButton`,
  `ToolbarGroup`, `BlockTypeMenu`, `InsertDialog`, `ColorSwatchPicker`,
  `OverflowMenu`). Each is built from Mantine primitives (`UnstyledButton`,
  `Menu`, `Modal`) with no visual styling of its own beyond structure and
  behavior: focus trapping, escape key, keyboard navigation, ARIA.
- **Layer 3** is the default theme: CSS (using `--editor-*` variables) plus a
  Mantine theme object. Turning it off leaves layers 1 and 2 intact.

This mirrors the "headless + default theme" requirement in spec §10 and keeps
`core` React-free (architecture doc §1): layer 1 lives in `react` because it
uses React hooks, but nothing above it leaks into `core`.

## 4. Adopting qari's Mantine integration rules

These apply to likhari as-is:

1. **Mantine is a peer dependency.** Hosts install `@mantine/core` and
   `@mantine/hooks` and import `@mantine/core/styles.css` once in their entry
   point. The library does **not** import that CSS itself (side-effect CSS
   imports in a library break plain Node ESM and remove host control over load
   order). Likhari's own stylesheet (`@inshapardaz/likhari-react/styles.css`)
   is likewise imported by the host.
2. **Internal nested `MantineProvider`.** The editor renders its own provider,
   so hosts do not need to wrap it. If the host already has a provider, Mantine
   merges nested themes, so the editor inherits the host's colors, fonts, and
   defaults automatically. The editor's `theme` prop is layered on top.
3. **CSS variables are scoped to the editor root**, not `:root`, via
   `cssVariablesSelector` and `getRootElement`. Multiple editors with
   different themes on one page stay independent and never leak into the host.
4. **`colorScheme` is not inherited** from the host provider. The editor takes
   an explicit `colorScheme` prop (`'light' | 'dark' | 'auto'`), scoped to its
   root, so a host's dark-mode toggle cannot desynchronize the toolbar from the
   canvas.
5. **Primary color follows the editor accent.** Mantine's
   `--mantine-primary-color-*` is re-pointed at `--editor-accent`, so any stock
   Mantine control inside a dialog matches the active theme.
6. **Portals target the editor root**, not `document.body`, so menus and dialogs
   stay visible when the editor is fullscreened (the browser's top layer hides
   anything outside the fullscreened subtree) and stay inside a Web Component's
   shadow root.
7. **Merge, don't replace.** `theme` deep-merges over the default theme.

**Difference from qari:** qari supports Mantine 8 and 9; likhari is on 9.x
today. Decide the supported range as part of the migration (see §9).

## 5. Default theme

Ships in layer 3 and is what users get with no configuration. It defines
(spec §10):

- Color palette, including the curated swatch set for text and highlight
  color pickers.
- Typography for Latin and Nastaliq, with separate base sizes and
  line-heights (UI spec §4). Do not share one value across scripts.
- Toolbar density and spacing.
- Light and dark variants.

The source of truth for color and type values remains the tokens in
`packages/core/src/theme/tokens.ts`. The Mantine theme object is *derived*
from those tokens, never a second copy.

```ts
// packages/react/src/theme/defaultTheme.ts (shape)
export const defaultMantineTheme = createTheme({
  primaryColor: 'likhariAccent',
  colors: { likhariAccent: scaleFrom(LIGHT_TOKENS.accent) },
  defaultRadius: 'sm',
  components: {
    Modal: { defaultProps: { centered: true, trapFocus: true } },
    Menu:  { defaultProps: { withinPortal: true } },
  },
});
```

## 6. Extending and customizing

Ordered from least to most effort. Each level is independent, so pick the
lowest one that does the job.

### 6.1 Change tokens with CSS variables (no React needed)

The `--editor-*` variables are the styling contract. They work in every
integration (React, Vue, Web Component) because they are plain CSS.

```css
.my-editor-host {
  --editor-accent: #7a3e9d;
  --editor-accent-soft: #f1e6f7;
  --editor-paper: #fffdf8;
  --editor-radius: 6px;
}
```

Stable variable names are part of the public API and only change in a major
release. The full list lives with the tokens in `packages/core`.

### 6.2 Override the Mantine theme

```tsx
import { EditorRoot } from '@inshapardaz/likhari-react';

<EditorRoot
  theme={{
    primaryColor: 'violet',
    fontFamily: 'Inter, sans-serif',
    components: {
      Modal: { defaultProps: { radius: 'lg' } },
    },
  }}
/>
```

`theme` is deep-merged over the default theme, so specify only what changes.
If the host app already renders a `MantineProvider`, omit `theme` entirely and
the editor inherits the host's look.

### 6.3 Restyle individual parts with the Styles API

Every layer 2 component exposes named parts through Mantine's `classNames`
and `styles`. Pass them once at the root and they apply to the matching parts:

```tsx
<EditorRoot
  classNames={{
    toolbar: 'my-toolbar',
    toolbarButton: 'my-btn',
    toolbarButtonActive: 'my-btn--on',
    dialog: 'my-dialog',
  }}
  styles={{
    toolbar: { borderBlockEnd: '2px solid var(--editor-accent)' },
  }}
/>
```

Use logical properties (`border-block-end`, `padding-inline-start`) in
overrides, not `left`/`right`, so your styles stay correct in RTL (UI spec §5).
The list of part names (the "selectors") is part of the public API.

### 6.4 Turn off the default theme (`unstyled`)

Keeps structure, behavior, and accessibility (layers 1 and 2) and removes all
default visuals (layer 3), so you supply every style yourself:

```tsx
<EditorRoot unstyled classNames={{ toolbar: 'my-toolbar', /* ... */ }} />
```

Two rules apply in unstyled mode: RTL mirroring still happens (it is behavior,
not visuals; see UI spec §5), and focus outlines are not removed, only
unstyled, so keep an accessible focus style.

### 6.5 Replace a control

Swap any slot component while keeping the rest of the toolbar. Replacements
receive the same props the default receives and are typed:

```tsx
import { EditorRoot, type ToolbarButtonProps } from '@inshapardaz/likhari-react';

function MyButton({ icon, label, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <button aria-pressed={active} aria-label={label} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
}

<EditorRoot components={{ ToolbarButton: MyButton }} />
```

Overridable slots (initial set): `Toolbar`, `ToolbarGroup`, `ToolbarButton`,
`BlockTypeMenu`, `OverflowMenu`, `ColorSwatchPicker`, `Dialog`. Replacement
components must forward `aria-*` props and honor `disabled`, because the
feature-flag config drives availability through these props (see the config
note in §7).

### 6.6 Build your own toolbar on the hooks

Skip layers 2 and 3 entirely:

```tsx
import { EditorRoot, useFormatState, useToolbarActions } from '@inshapardaz/likhari-react';

function MyToolbar() {
  const { bold, italic } = useFormatState();
  const { toggleFormat, undo } = useToolbarActions();
  return (
    <div role="toolbar" aria-label="Formatting">
      <button aria-pressed={bold} onClick={() => toggleFormat('bold')}>B</button>
      <button aria-pressed={italic} onClick={() => toggleFormat('italic')}>I</button>
      <button onClick={undo}>Undo</button>
    </div>
  );
}

<EditorRoot toolbar={<MyToolbar />} />
```

Passing `toolbar` replaces the built-in toolbar; the hooks must be used
inside `EditorRoot`'s subtree.

### 6.7 Extend the default theme from a package

To publish a reusable theme (for example, a house style shared across your
apps), export a partial Mantine theme and a CSS file that sets `--editor-*`
variables. Consumers apply it with `theme` plus a class on the host element:

```ts
// my-brand-theme.ts
import { mergeMantineTheme } from '@mantine/core';
import { defaultMantineTheme } from '@inshapardaz/likhari-react';
export const brandTheme = mergeMantineTheme(defaultMantineTheme, { primaryColor: 'teal' });
```

### 6.8 Non-React hosts

The Web Component and Vue wrappers cannot accept a Mantine theme object
(spec §10), so they expose:

- The same `--editor-*` CSS variables (6.1). These inherit into the shadow
  root, so setting them on the host element or any ancestor works.
- A `color-scheme` attribute (`light | dark | auto`).
- For anything CSS variables cannot express, `::part()` selectors on the
  shadow-DOM parts that correspond to the Styles API selectors in 6.3
  (`::part(toolbar)`, `::part(toolbar-button)`, ...).

Host page CSS does not reach inside a shadow root unless explicitly pierced
(`adoptedStyleSheets`), which is why the variables and parts are the supported
route.

## 7. Contracts that must not break

1. **Feature toggles control availability, not registration.** Replacement
   components and custom toolbars are driven by `EditorFeatureConfig`
   (`isEnabled(feature)` from the hooks). All custom Lexical nodes stay
   registered regardless of config (architecture doc §2). A custom toolbar that
   ignores config is the host's choice, but must not un-register nodes.
2. **RTL mirroring rules apply to replacements.** Directional icons flip and
   non-directional icons (bold, italic, undo semantics as specified) do not.
   Expose an `isRtl` value from the hooks so custom UI can follow the UI spec
   §5 table.
3. **Stable public surface:** the `--editor-*` variable names, Styles API
   selector names, slot component names and props, and the hook signatures.
   Anything else is internal.
4. **Accessibility is behavior, not styling.** Focus management, roles, and
   keyboard handling live in layers 1 and 2 and survive `unstyled`.

## 8. Migration plan

1. ✅ Done. Move `@mantine/core` and `@mantine/hooks` to `peerDependencies`;
   remove the `styles.css` import from `EditorThemeProvider`; export
   `@inshapardaz/likhari-react/styles.css`.
2. Extract layer 1 hooks from `Toolbar.tsx`.
3. Rebuild toolbar pieces on `UnstyledButton` / `Menu` / `Modal`; add Styles
   API selectors, `unstyled`, `classNames`, `styles`, `components`, `toolbar`.
4. Partially done — CSS variables and portals are already scoped to the
   editor root (rule 3 in §4; landed alongside other toolbar/dialog fixes).
   Still needed: make `theme` fully deep-merge (rule 6 in §4) — today only
   `theme.colors` shallow-merges, for the `accentColor` prop specifically.
5. Derive the default Mantine theme from `core` tokens (done); add dark-scheme
   handling and the `colorScheme` prop (done — also scoped per editor root,
   going further than originally planned here).
6. Tests: theme merge, `unstyled` output has no default classes, fullscreen
   portal target, two editors with different themes stay independent, RTL
   mirroring in replaced components.
7. Update the demo app with a "custom theme" and "custom toolbar" example.

## 9. Open questions

- **Mantine version range.** Now on 9.x (React 19.2+). Also support 8 (as qari does) at the same
  time as the peer-dependency move? A range wider than one major needs a test
  matrix.
- **`toolbar` vs `components.Toolbar`.** Two ways to replace the toolbar (6.5
  and 6.6). Keep both, or fold the `toolbar` prop into `components`?
- **Where do the hooks ship?** In `react` (needs React) with the Vue wrapper
  building on the Web Component instead. Confirm this is acceptable for the
  Phase 5 wrappers.
- **Contradiction to resolve with UI spec §8.** It says the theme object exposes
  tokens as `--editor-*` "so a host overriding the Mantine theme doesn't have
  to touch component code". That holds, but combined with rule 5 (primary
  color follows `--editor-accent`), a host that sets only `primaryColor` in
  the `theme` prop will *not* change the editor accent. Decide which wins and
  document it.
