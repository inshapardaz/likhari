import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import type { FormatConverter } from '../types';
import { collectFootnoteOrder, type SNode } from '../shared/serialized';

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
function nodeToText(node: SerializedLexicalNode, order: Map<string, number>, listItemIndex = 0): string {
  const withChildren = node as NodeWithChildren;

  if (node.type === 'text' || node.type === 'linebreak') {
    return (node as SerializedTextNodeLike).text ?? (node.type === 'linebreak' ? '\n' : '');
  }

  // Images have no plain-text form; keep their alt text (or caption) so
  // previews and search indexing still see what the image is about.
  if (node.type === 'image') {
    const image = node as SerializedLexicalNode & { altText?: string; caption?: string | null };
    return image.altText || image.caption || '';
  }

  // Inline marker only — its matching note is in the trailing list (below),
  // never inline, per the fidelity matrix's "inline bracketed number".
  if (node.type === 'footnote-reference') {
    const id = String((node as SerializedLexicalNode & { footnoteId?: string }).footnoteId ?? '');
    return `[${order.get(id) ?? '?'}]`;
  }

  // Linearized per the fidelity matrix ("Poetry layout variants ⚠️ linearized"):
  // the two misras, one per line, regardless of single/two-column layout —
  // the columns primitive a two-column couplet is built on otherwise has no
  // per-node case and would fall through to running the lines together.
  if (node.type === 'poetry-couplet') {
    const children = withChildren.children ?? [];
    const misraHolders = children[0]?.type === 'layout-container' ? ((children[0] as NodeWithChildren).children ?? []) : children;
    return misraHolders.map((child) => nodeToText(child, order)).join('\n');
  }

  if (node.type === 'list' && withChildren.children) {
    const listType = (node as { listType?: string }).listType ?? 'bullet';
    return withChildren.children
      .map((child, i) => {
        const prefix = LIST_ITEM_PREFIX[listType]?.(i) ?? '- ';
        return prefix + nodeToText(child, order, i);
      })
      .join('\n');
  }

  if (withChildren.children) {
    return withChildren.children.map((child) => nodeToText(child, order, listItemIndex)).join('');
  }

  return '';
}

function blockToText(node: SerializedLexicalNode, order: Map<string, number>): string {
  return nodeToText(node, order);
}

/** `[n] note text` per footnote, in display-number order — the "trailing
 * list" half of the fidelity matrix's plain-text footnote entry. */
function footnoteListToText(node: SerializedLexicalNode, order: Map<string, number>): string {
  const items = (node as NodeWithChildren).children ?? [];
  return items
    .map((item) => {
      const id = String((item as SerializedLexicalNode & { footnoteId?: string }).footnoteId ?? '');
      return `[${order.get(id) ?? '?'}] ${nodeToText(item, order)}`;
    })
    .join('\n');
}

export const plainTextConverter: FormatConverter = {
  id: 'plain-text',

  serialize(editorState) {
    const root = editorState.root as unknown as NodeWithChildren;
    const children = root.children ?? [];
    const order = collectFootnoteOrder(children as SNode[]);
    const footnoteLists = children.filter((n) => n.type === 'footnote-list');
    const blocks = children.filter((n) => n.type !== 'footnote-list').map((n) => blockToText(n, order));
    if (footnoteLists.length > 0) blocks.push(footnoteLists.map((n) => footnoteListToText(n, order)).join('\n'));
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
