import { useEffect, type MutableRefObject } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { LexicalEditor } from 'lexical';

/** Hands the composer's editor to the component that owns the imperative ref. */
export function EditorInstancePlugin({ instanceRef }: { instanceRef: MutableRefObject<LexicalEditor | null> }): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    instanceRef.current = editor;
    return () => {
      instanceRef.current = null;
    };
  }, [editor, instanceRef]);
  return null;
}
