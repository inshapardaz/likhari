import { useState } from 'react';

const STORAGE_KEY = 'likhari-toolbar-hidden-items';

function readHidden(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeHidden(hidden: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // Storage disabled or full: the choice applies for this session only.
  }
}

/**
 * Which toolbar items the user has chosen to hide, kept in localStorage so the
 * choice survives a reload. A feature a host turned off (`EditorFeatureConfig`)
 * is never offered here and is unaffected by it — this only lets the user declutter
 * what the host already made available, it does not re-gate availability.
 */
export function useToolbarItemVisibility(): { hidden: ReadonlySet<string>; isHidden: (id: string) => boolean; toggle: (id: string) => void } {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => (typeof localStorage === 'undefined' ? new Set() : readHidden()));

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeHidden(next);
      return next;
    });
  };

  return { hidden, isHidden: (id: string) => hidden.has(id), toggle };
}

/** One toggleable row in the toolbar settings panel. */
export interface ToolbarVisibilityItem {
  id: string;
  label: string;
}

/** A labelled group of toggleable rows, as shown in the toolbar settings panel. */
export interface ToolbarVisibilityGroup {
  id: string;
  label: string;
  items: ToolbarVisibilityItem[];
}
