import editorCss from '@inshapardaz/likhari-react/styles.css?inline';
import mantineCss from '@mantine/core/styles.css?inline';
import { defineLikhariEditor } from './likhari-editor';

export { LikhariEditorElement, defineLikhariEditor } from './likhari-editor';
export { attributesToProps, OBSERVED_ATTRIBUTES } from './attributes';

const STYLE_ID = 'likhari-editor-styles';

/** Adds the editor's and Mantine's styles to the document head, once. */
function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `${mantineCss}\n${editorCss}`;
  document.head.append(style);
}

ensureStyles();
defineLikhariEditor();
