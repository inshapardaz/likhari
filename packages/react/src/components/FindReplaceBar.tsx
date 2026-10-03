import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { IconX } from '@tabler/icons-react';
import type { Strings } from '../i18n/strings';
import { $findMatches, $replaceAll, $replaceMatch, $selectMatch, type FindMatch } from '../find/findReplaceActions';

/** Find-and-replace controls shown above the canvas. Matches are recomputed
 * from the document on every action, so edits made in between are respected. */
export function FindReplaceBar({ strings, onClose }: { strings: Strings; onClose: () => void }) {
  const [editor] = useLexicalComposerContext();
  const t = strings.findReplace;
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);

  // Runs `action` against the current matches and returns the new count, then
  // syncs the index and selection. `discrete` makes the update commit before
  // the next read, so the count reflects this action's changes.
  const run = (action: (matches: FindMatch[]) => { nextIndex: number; matches: FindMatch[] }) => {
    let result = { nextIndex: 0, matches: [] as FindMatch[] };
    editor.update(
      () => {
        result = action($findMatches(query));
        if (result.matches[result.nextIndex]) $selectMatch(result.matches[result.nextIndex]);
      },
      { discrete: true },
    );
    setCount(result.matches.length);
    setIndex(result.nextIndex);
    const anchor = result.matches[result.nextIndex];
    if (anchor) editor.getElementByKey(anchor.anchorKey)?.scrollIntoView({ block: 'center' });
  };

  useEffect(() => {
    run((matches) => ({ nextIndex: 0, matches }));
    // Re-run when the query changes; `run` closes over it.
  }, [query]);

  const step = (delta: 1 | -1) =>
    run((matches) => ({
      matches,
      nextIndex: matches.length === 0 ? 0 : (index + delta + matches.length) % matches.length,
    }));

  const replaceCurrent = () =>
    run((matches) => {
      const match = matches[index];
      if (match) $replaceMatch(match, replacement);
      const after = $findMatches(query);
      return { matches: after, nextIndex: Math.min(index, Math.max(0, after.length - 1)) };
    });

  const replaceEverything = () =>
    run(() => {
      $replaceAll(query, replacement);
      return { matches: $findMatches(query), nextIndex: 0 };
    });

  const status = query === '' ? '' : count === 0 ? t.noMatches : `${index + 1} / ${count}`;

  return (
    <div className="likhari-find-bar" role="search">
      <input
        aria-label={t.find}
        placeholder={t.findPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(e.shiftKey ? -1 : 1);
          if (e.key === 'Escape') onClose();
        }}
      />
      <span className="likhari-find-status" aria-live="polite">
        {status}
      </span>
      <button type="button" onClick={() => step(-1)} disabled={count === 0}>
        {t.previous}
      </button>
      <button type="button" onClick={() => step(1)} disabled={count === 0}>
        {t.next}
      </button>
      <input
        aria-label={t.replace}
        placeholder={t.replacePlaceholder}
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
      />
      <button type="button" onClick={replaceCurrent} disabled={count === 0}>
        {t.replaceOne}
      </button>
      <button type="button" onClick={replaceEverything} disabled={count === 0}>
        {t.replaceAll}
      </button>
      <button type="button" className="likhari-find-close" onClick={onClose} aria-label={t.close} title={t.close}>
        <IconX size={16} stroke={1.75} />
      </button>
    </div>
  );
}
