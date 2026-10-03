import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { IconChevronDown, IconChevronRight, IconRepeat, IconReplace, IconX } from '@tabler/icons-react';
import type { Strings } from '../i18n/strings';
import { $findMatches, $replaceAll, $replaceMatch, $selectMatch, type FindMatch } from '../find/findReplaceActions';

/**
 * A compact find widget, right-aligned above the canvas (VS Code style). The
 * first row is search; a chevron reveals the second row for replace. Typing
 * only counts matches — the editor's selection moves to a match only when the
 * user asks (next, previous, replace), so typing keeps going into the bar.
 */
export function FindReplaceBar({ strings, dir, onClose }: { strings: Strings; dir: 'ltr' | 'rtl'; onClose: () => void }) {
  const [editor] = useLexicalComposerContext();
  const t = strings.findReplace;
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const findInput = useRef<HTMLInputElement>(null);

  // Runs `action` against the current matches inside a committed update, then
  // syncs the count and index. Selecting a match is up to the action, so
  // typing never moves the editor's selection.
  const run = (action: (matches: FindMatch[]) => { nextIndex: number; matches: FindMatch[]; select: boolean }) => {
    let result = { nextIndex: 0, matches: [] as FindMatch[], select: false };
    editor.update(
      () => {
        result = action($findMatches(query));
        const match = result.matches[result.nextIndex];
        if (result.select && match) $selectMatch(match);
      },
      { discrete: true },
    );
    setCount(result.matches.length);
    setIndex(result.nextIndex);
    const match = result.matches[result.nextIndex];
    if (result.select && match) {
      editor.getElementByKey(match.anchorKey)?.scrollIntoView({ block: 'center' });
      findInput.current?.focus();
    }
  };

  useEffect(() => {
    run((matches) => ({ nextIndex: 0, matches, select: false }));
    // Re-count when the query changes; `run` closes over it.
  }, [query]);

  const step = (delta: 1 | -1) =>
    run((matches) => ({
      matches,
      nextIndex: matches.length === 0 ? 0 : (index + delta + matches.length) % matches.length,
      select: true,
    }));

  const replaceCurrent = () =>
    run((matches) => {
      const match = matches[index];
      if (match) $replaceMatch(match, replacement);
      const after = $findMatches(query);
      return { matches: after, nextIndex: Math.min(index, Math.max(0, after.length - 1)), select: true };
    });

  const replaceEverything = () =>
    run(() => {
      $replaceAll(query, replacement);
      return { matches: $findMatches(query), nextIndex: 0, select: false };
    });

  const status = query === '' ? '' : count === 0 ? t.noMatches : `${index + 1} / ${count}`;
  const Chevron = showReplace ? IconChevronDown : IconChevronRight;

  return (
    <div className="likhari-find-widget" role="search" dir={dir}>
      <div className="likhari-find-row">
        <button
          type="button"
          className="likhari-find-icon"
          onClick={() => setShowReplace((v) => !v)}
          aria-label={t.replace}
          aria-expanded={showReplace}
          title={t.replace}
        >
          <Chevron size={14} stroke={1.75} />
        </button>
        <input
          ref={findInput}
          aria-label={t.find}
          placeholder={t.findPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') step(e.shiftKey ? -1 : 1);
            if (e.key === 'Escape') onClose();
          }}
          autoFocus
        />
        <span className="likhari-find-status" aria-live="polite">
          {status}
        </span>
        <button type="button" className="likhari-find-icon" onClick={() => step(-1)} disabled={count === 0} aria-label={t.previous} title={t.previous}>
          <IconChevronDown size={14} stroke={1.75} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button type="button" className="likhari-find-icon" onClick={() => step(1)} disabled={count === 0} aria-label={t.next} title={t.next}>
          <IconChevronDown size={14} stroke={1.75} />
        </button>
        <button type="button" className="likhari-find-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
      {showReplace && (
        <div className="likhari-find-row">
          <span className="likhari-find-icon-spacer" aria-hidden="true" />
          <input
            className="likhari-find-replace-input"
            aria-label={t.replace}
            placeholder={t.replacePlaceholder}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && count > 0) replaceCurrent();
            }}
          />
          <button type="button" className="likhari-find-icon likhari-find-replace-one" onClick={replaceCurrent} disabled={count === 0} aria-label={t.replaceOne} title={t.replaceOne}>
            <IconReplace size={14} stroke={1.75} />
          </button>
          <button type="button" className="likhari-find-icon likhari-find-replace-all" onClick={replaceEverything} disabled={count === 0} aria-label={t.replaceAll} title={t.replaceAll}>
            <IconRepeat size={14} stroke={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}
