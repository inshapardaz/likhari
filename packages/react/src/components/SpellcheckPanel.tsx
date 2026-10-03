import { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import type { Strings } from '../i18n/strings';
import { $replaceMatch, $selectMatch, type FindMatch } from '../find/findReplaceActions';
import { $collectMisspellings } from '../spellcheck/spellcheckActions';
import { getSpeller, hasSpellDictionary, type SpellLanguage } from '../spellcheck/spellDictionaries';

const LANGUAGES: { value: SpellLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
  { value: 'pa-shahmukhi', label: 'پنجابی (شاہ مکھی)' },
];

interface Item {
  word: string;
  match: FindMatch;
  suggestions: string[];
}

const SUGGESTIONS_PER_WORD = 3;

/**
 * Steps through the misspelled words one at a time, like the find widget.
 * Each word is selected in the editor as it comes up, and its suggestions
 * can replace it. Checking reads the document on demand, so it never flags
 * words while the user is still typing.
 */
export function SpellcheckPanel({ strings, onClose }: { strings: Strings; onClose: () => void }) {
  const [editor] = useLexicalComposerContext();
  const t = strings.spellcheck;
  const [language, setLanguage] = useState<SpellLanguage>('en');
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [checking, setChecking] = useState(false);

  const available = hasSpellDictionary(language);
  const current = items?.[index];

  // Selects an item in the editor and focuses the editor, so the selection is
  // drawn (Lexical only draws it while the editor has focus).
  const show = (list: Item[], at: number) => {
    const item = list[at];
    if (!item) return;
    editor.update(() => $selectMatch(item.match), { discrete: true });
    editor.getElementByKey(item.match.anchorKey)?.scrollIntoView({ block: 'center' });
    editor.focus();
  };

  const check = async () => {
    const speller = getSpeller(language);
    if (!speller) return;
    setChecking(true);
    const resolved = await speller;
    const found = editor.getEditorState().read(() => $collectMisspellings({ ltr: resolved, rtl: resolved }));
    const list = found.map((m) => ({
      ...m,
      suggestions: resolved.suggest(m.word).slice(0, SUGGESTIONS_PER_WORD),
    }));
    setItems(list);
    setIndex(0);
    setChecking(false);
    show(list, 0);
  };

  const step = (delta: 1 | -1) => {
    if (!items || items.length === 0) return;
    const next = (index + delta + items.length) % items.length;
    setIndex(next);
    show(items, next);
  };

  // Replacing changes the document, so the list is checked again afterwards.
  // Only a word still at the same place is replaced, in case the document
  // changed since the check.
  const replace = async (item: Item, suggestion: string) => {
    const speller = getSpeller(language);
    if (!speller) return;
    const resolved = await speller;
    editor.update(
      () => {
        const match = $collectMisspellings({ ltr: resolved, rtl: resolved }).find(
          (m) => m.word === item.word && m.match.anchorKey === item.match.anchorKey && m.match.anchorOffset === item.match.anchorOffset,
        );
        if (match) $replaceMatch(match.match, suggestion);
      },
      { discrete: true },
    );
    await check();
  };

  const status = items === null ? '' : items.length === 0 ? t.noMisspellings : `${index + 1} / ${items.length}`;

  return (
    <div className="likhari-spell-panel" role="region" aria-label={t.title} dir={language === 'en' ? 'ltr' : 'rtl'}>
      <div className="likhari-spell-header">
        <strong>{t.title}</strong>
        <button type="button" className="likhari-spell-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
      <div className="likhari-spell-controls">
        <select
          aria-label={t.language}
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as SpellLanguage);
            setItems(null);
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
              {hasSpellDictionary(l.value) ? '' : ` (${t.noDictionary})`}
            </option>
          ))}
        </select>
        <button type="button" onClick={check} disabled={!available || checking}>
          {t.check}
        </button>
      </div>
      {!available && <p className="likhari-spell-note">{t.noDictionary}</p>}
      {items !== null && (
        <div className="likhari-spell-nav">
          <button
            type="button"
            className="likhari-spell-icon"
            onClick={() => step(-1)}
            disabled={items.length === 0}
            aria-label={t.previous}
            title={t.previous}
          >
            <IconChevronDown size={14} stroke={1.75} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="likhari-spell-status" aria-live="polite">
            {status}
          </span>
          <button
            type="button"
            className="likhari-spell-icon"
            onClick={() => step(1)}
            disabled={items.length === 0}
            aria-label={t.next}
            title={t.next}
          >
            <IconChevronDown size={14} stroke={1.75} />
          </button>
        </div>
      )}
      {current && (
        <div className="likhari-spell-item">
          <span className="likhari-spell-word">{current.word}</span>
          {current.suggestions.length === 0 ? (
            <span className="likhari-spell-note">{t.noSuggestions}</span>
          ) : (
            <div className="likhari-spell-suggestions">
              {current.suggestions.map((s) => (
                <button key={s} type="button" className="likhari-spell-suggestion" onClick={() => replace(current, s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
