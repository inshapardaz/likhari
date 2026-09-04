import type { Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';

/**
 * Node types registered on the editor at construction time. Per
 * editor-architecture-design.md §2, node registration cannot be conditional
 * on EditorFeatureConfig — Lexical throws on an unregistered node type
 * during parseEditorState. This list is Phase 1's set (built-ins only);
 * Phase 3's custom nodes (poetry, footnote, layout, page break, image) join
 * this list unconditionally once implemented — the feature config will then
 * control their toolbar/insert availability, not whether they're registered.
 */
export const EDITOR_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  HorizontalRuleNode,
];
