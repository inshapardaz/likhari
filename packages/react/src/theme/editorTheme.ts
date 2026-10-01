import type { EditorThemeClasses } from 'lexical';

/**
 * Maps Lexical node/format kinds to the CSS classes defined in editor.css.
 * Class names are prefixed `likhari-` to stay collision-free in a host page
 * (the "headless + default theme" requirement, UI spec §10).
 */
export const editorTheme: EditorThemeClasses = {
  // Applied by Lexical's reconciler to each top-level block based on that
  // block's own detected direction — see the comment in editor.css. This is
  // the per-block half of mixed-direction document support (requirements
  // doc §3.2); the EditorRoot `dir` prop handles the whole-document default.
  ltr: 'likhari-ltr',
  rtl: 'likhari-rtl',
  paragraph: 'likhari-paragraph',
  quote: 'likhari-quote',
  heading: {
    h1: 'likhari-h1',
    h2: 'likhari-h2',
    h3: 'likhari-h3',
    h4: 'likhari-h4',
    h5: 'likhari-h5',
    h6: 'likhari-h6',
  },
  list: {
    listitem: 'likhari-listitem',
    listitemChecked: 'likhari-listitem-checked',
    listitemUnchecked: 'likhari-listitem-unchecked',
    nested: { listitem: 'likhari-nested-listitem' },
    olDepth: ['likhari-ol'],
    ul: 'likhari-ul',
  },
  link: 'likhari-link',
  text: {
    bold: 'likhari-text-bold',
    italic: 'likhari-text-italic',
    underline: 'likhari-text-underline',
    strikethrough: 'likhari-text-strikethrough',
    subscript: 'likhari-text-subscript',
    superscript: 'likhari-text-superscript',
  },
  hr: 'likhari-hr',
  image: 'likhari-image-block',
  pageBreak: 'likhari-page-break',
  layoutContainer: 'likhari-layout-container',
  layoutItem: 'likhari-layout-item',
  table: 'likhari-table',
  tableRow: 'likhari-table-row',
  tableCell: 'likhari-table-cell',
  tableCellHeader: 'likhari-table-cell-header',
  tableCellSelected: 'likhari-table-cell-selected',
};
