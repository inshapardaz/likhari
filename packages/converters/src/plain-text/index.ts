import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import type { FormatConverter } from '../types';

interface NodeWithChildren extends SerializedLexicalNode {
  children?: SerializedLexicalNode[];
}

interface SerializedTextNodeLike extends SerializedLexicalNode {
  text?: string;
}

const LIST_ITEM_PREFIX: Record<string, (index: number) => string> = {
  bullet: () => '- ',
  number: (index) => `${index + 1}. `,
  check: () => '- ',
};

/**
 * Walks a SerializedEditorState tree and produces its plain-text projection.
 * Per the fidelity matrix (lexical-editor-spec.md §2.2), plain text strips
 * all formatting — this is a documented, exhaustive mapping per node type,
 * not an ad hoc `.textContent` walk.
 */
function nodeToText(node: SerializedLexicalNode, listItemIndex = 0): string {
  const withChildren = node as NodeWithChildren;

  if (node.type === 'text' || node.type === 'linebreak') {
    return (node as SerializedTextNodeLike).text ?? (node.type === 'linebreak' ? '\n' : '');
  }

  if (node.type === 'list' && withChildren.children) {
    const listType = (node as { listType?: string }).listType ?? 'bullet';
    return withChildren.children
      .map((child, i) => {
        const prefix = LIST_ITEM_PREFIX[listType]?.(i) ?? '- ';
        return prefix + nodeToText(child, i);
      })
      .join('\n');
  }

  if (withChildren.children) {
    return withChildren.children.map((child) => nodeToText(child, listItemIndex)).join('');
  }

  return '';
}

function blockToText(node: SerializedLexicalNode): string {
  return nodeToText(node);
}

export const plainTextConverter: FormatConverter = {
  id: 'plain-text',

  serialize(editorState) {
    const root = editorState.root as unknown as NodeWithChildren;
    const blocks = (root.children ?? []).map(blockToText);
    return blocks.join('\n\n');
  },

  parse(input) {
    const paragraphs = input.split(/\r?\n\r?\n/);
    const children = paragraphs.map((paragraph) => ({
      type: 'paragraph',
      children: paragraph
        ? [
            {
              type: 'text',
              text: paragraph.replace(/\r?\n/g, '\n'),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ]
        : [],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    }));

    return {
      root: {
        type: 'root',
        children: children.length > 0 ? children : [{
          type: 'paragraph',
          children: [],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    } as unknown as SerializedEditorState;
  },
};
