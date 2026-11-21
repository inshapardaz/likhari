import { forwardRef } from 'react';
import type { IconProps } from '@tabler/icons-react';

/**
 * A handful of icons for poetry-couplet actions that @tabler/icons-react has no
 * distinct enough pair for: deleting one couplet vs. the whole block (both would
 * otherwise be a plain `IconTrash`), the couplet's row spacing vs. its staggered
 * horizontal offset, and the two-column layout's center width vs. its gutter
 * (all four would otherwise reuse the same arrows-in/arrows-out icon). Built in
 * the same shape as a Tabler icon — 24x24, outline, round caps and joins — so
 * they sit in the toolbar and context menu without looking out of place.
 */
function createPoetryIcon(name: string, paths: string[]) {
  const Component = forwardRef<SVGSVGElement, IconProps>(function PoetryIcon(
    { color = 'currentColor', size = 24, stroke = 2, title, className, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={['likhari-icon', `likhari-icon-${name}`, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {title && <title>{title}</title>}
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        {paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    );
  });
  Component.displayName = name;
  return Component;
}

/** A trash can with a single line inside it: delete this one couplet. */
export const IconCoupletDelete = createPoetryIcon('couplet-delete', [
  'M4 7h16',
  'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3',
  'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12',
  'M12 11v6',
]);

/** A trash can with three lines inside it: delete every couplet in the block. */
export const IconPoetryDelete = createPoetryIcon('poetry-delete', [
  'M4 7h16',
  'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3',
  'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12',
  'M9 11v6',
  'M12 11v6',
  'M15 11v6',
]);

/** Two full-width rows pinched together: tighten the vertical gap between couplets. */
export const IconCoupletSpacingTight = createPoetryIcon('couplet-spacing-tight', [
  'M4 5h16',
  'M4 19h16',
  'M9 9l3 3l3 -3',
  'M9 15l3 -3l3 3',
]);

/** Two full-width rows pulled apart: loosen the vertical gap between couplets. */
export const IconCoupletSpacingLoose = createPoetryIcon('couplet-spacing-loose', [
  'M4 5h16',
  'M4 19h16',
  'M9 10l3 -3l3 3',
  'M9 14l3 3l3 -3',
]);

/** Two staggered (alternating-side) rows pinched together: narrow the stagger offset. */
export const IconCoupletStaggerNarrow = createPoetryIcon('couplet-stagger-narrow', [
  'M4 7h7',
  'M13 17h7',
  'M9 9l3 3l-3 3',
  'M15 9l-3 3l3 3',
]);

/** Two staggered (alternating-side) rows pulled apart: widen the stagger offset. */
export const IconCoupletStaggerWide = createPoetryIcon('couplet-stagger-wide', [
  'M4 7h7',
  'M13 17h7',
  'M10 9l-3 3l3 3',
  'M14 9l3 3l-3 3',
]);

/** Four column rails, the inner pair pinched together: narrow the center column. */
export const IconCoupletCenterNarrow = createPoetryIcon('couplet-center-narrow', [
  'M4 4v16',
  'M10 4v16',
  'M14 4v16',
  'M20 4v16',
  'M9 9l3 3l-3 3',
  'M15 9l-3 3l3 3',
]);

/** Four column rails, the inner pair pulled apart: widen the center column. */
export const IconCoupletCenterWide = createPoetryIcon('couplet-center-wide', [
  'M4 4v16',
  'M10 4v16',
  'M14 4v16',
  'M20 4v16',
  'M10 9l-3 3l3 3',
  'M14 9l3 3l-3 3',
]);

/** Two column rails pinched together: narrow the gutter between the columns. */
export const IconCoupletGutterNarrow = createPoetryIcon('couplet-gutter-narrow', [
  'M10 4v16',
  'M14 4v16',
  'M9 9l3 3l-3 3',
  'M15 9l-3 3l3 3',
]);

/** Two column rails pulled apart: widen the gutter between the columns. */
export const IconCoupletGutterWide = createPoetryIcon('couplet-gutter-wide', [
  'M10 4v16',
  'M14 4v16',
  'M10 9l-3 3l3 3',
  'M14 9l3 3l-3 3',
]);

/** Six short, evenly-spaced horizontal lines: a musaddas stanza's six misras,
 * stacked with no grouping — distinct from mukhammas' 5-then-1 split below. */
export const IconPoetryMusaddas = createPoetryIcon('poetry-musaddas', [
  'M5 2h14',
  'M5 6h14',
  'M5 10h14',
  'M5 14h14',
  'M5 18h14',
  'M5 22h14',
]);

/** Five closely-stacked horizontal lines, a visible gap, then one more,
 * shorter line below: a mukhammas stanza's 5-line group (the shared radif
 * lines) plus its own distinct closing misra. */
export const IconPoetryMukhammas = createPoetryIcon('poetry-mukhammas', [
  'M5 2h14',
  'M5 5h14',
  'M5 8h14',
  'M5 11h14',
  'M5 14h14',
  'M7 21h10',
]);

/** Four closely-stacked full-width lines, a visible gap, then two more: a
 * musaddas stanza's `stanzaVariant: 'split'` grouping (4+2) — same flat
 * physical shape as `continuous`, just with the secondary gap shown. */
export const IconPoetrySplitMusaddas = createPoetryIcon('poetry-split-musaddas', [
  'M5 2h14',
  'M5 5h14',
  'M5 8h14',
  'M5 11h14',
  'M5 17h14',
  'M5 20h14',
]);

/** Three closely-stacked full-width lines, a visible gap, then two more: a
 * mukhammas stanza's `stanzaVariant: 'split'` grouping (3+2) — same flat
 * physical shape as `continuous`, just with the secondary gap shown. */
export const IconPoetrySplitMukhammas = createPoetryIcon('poetry-split-mukhammas', [
  'M5 2h14',
  'M5 5h14',
  'M5 8h14',
  'M5 14h14',
  'M5 17h14',
]);

/** Two rows of a short side-by-side line pair (a 2-column grid), then one
 * shorter, horizontally-centered line below: a musaddas/mukhammas stanza's
 * `stanzaVariant: 'mixed'` grouping — 2 two-column rows followed by its
 * remaining misra(s) as trailing flat line(s). One shared icon for both
 * layouts (the actual trailing-line count differs — 2 for musaddas, 1 for
 * mukhammas — but the shape this icon suggests is the same either way). */
export const IconPoetryMixed = createPoetryIcon('poetry-mixed', [
  'M3 6h7',
  'M14 6h7',
  'M3 12h7',
  'M14 12h7',
  'M8 18h8',
]);
