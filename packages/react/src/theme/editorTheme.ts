import type { EditorThemeClasses } from 'lexical';

/**
 * Maps Lexical node/format kinds to the CSS classes defined in editor.css.
 * Class names are prefixed `likhari-` to stay collision-free in a host page
 * (the "headless + default theme" requirement, UI spec §10).
 */
export const editorTheme: EditorThemeClasses = {
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
};
