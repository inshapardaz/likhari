/** Minimal structural view of an mdast node: the dialect's tree is composed of
 * several plugin-defined node types, so a loose type is more honest than a union. */
export interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  spread?: boolean;
  checked?: boolean | null;
  url?: string;
  title?: string | null;
  alt?: string | null;
  lang?: string | null;
  name?: string;
  attributes?: Record<string, string | null | undefined> | null;
  align?: Array<'left' | 'right' | 'center' | null> | null;
  /** GFM footnotes (remark-gfm): `identifier` is normalized/lowercased by
   * remark itself, `label` keeps the original casing. We only ever use
   * plain numerals for both, so the distinction doesn't matter here. */
  identifier?: string;
  label?: string;
}

export type Attrs = Record<string, string>;

export function directive(type: 'textDirective' | 'leafDirective' | 'containerDirective', name: string, attributes: Attrs, children: MdNode[] = []): MdNode {
  return { type, name, attributes, children };
}
