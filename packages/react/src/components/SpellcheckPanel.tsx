import { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { IconX } from '@tabler/icons-react';
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
 * A panel listing the misspelled words in the document, with suggestions.
 * Checking is on demand: the panel reads the document when Check is pressed,
 * so it never flags words while the user is still typing.
 */
export function SpellcheckPanel({ strings, onClose }: { strings: Strings; onClose: () => void }) {
  const [editor] = useLexicalComposerContext();
  const t = strings.spellcheck;
  const [language, setLanguage] = useState<SpellLanguage>('en');
  const [items, setItems] = useState<Item[] | null>(null);
  const [checking, setChecking] = useState(false);

  const available = hasSpellDictionary(language);

  const check = async () => {
    const speller = getSpeller(language);
    if (!speller) return;
    setChecking(true);
    const resolved = await speller;
    const found = editor.getEditorState().read(() => $collectMisspellings({ ltr: resolved, rtl: resolved }));
    setItems(
      found.map((m) => ({
        ...m,
        suggestions: resolved.suggest(m.word).slice(0, SUGGESTIONS_PER_WORD),
      })),
    );
    setChecking(false);
  };

  const select = (item: Item) => {
    editor.update(() => $selectMatch(item.match), { discrete: true });
    editor.focus();
  };

  // Replacing changes the document, so the list is re-checked afterwards rather
  // than edited in place.
  const replace = async (item: Item, suggestion: string) => {
    const speller = getSpeller(language);
    if (!speller) return;
    const resolved = await speller;
    editor.update(
      () => {
        // The list can be stale if the document changed since it was checked:
        // only replace if the same word is still at the same place.
        const current = $collectMisspellings({ ltr: resolved, rtl: resolved }).find(
          (m) => m.word === item.word && m.match.anchorKey === item.match.anchorKey && m.match.anchorOffset === item.match.anchorOffset,
        );
        if (current) $replaceMatch(current.match, suggestion);
      },
      { discrete: true },
    );
    await check();
  };

  return (
    <div className="likhari-spell-panel" role="region" aria-label={t.title} dir={language === 'en' ? 'ltr' : 'rtl'}>
      <div className="likhari-spell-header">
        <strong>{t.title}</strong>
        <button type="button" className="likhari-spell-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
      <div className="likhari-spell-controls">
        <select aria-label={t.language} value={language} onChange={(e) => { setLanguage(e.target.value as SpellLanguage); setItems(null); }}>
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
      {items !== null && items.length === 0 && <p className="likhari-spell-note">{t.noMisspellings}</p>}
      {items !== null && items.length > 0 && (
        <ul className="likhari-spell-list">
          {items.map((item, i) => (
            <li key={`${item.match.anchorKey}-${item.match.anchorOffset}-${i}`}>
              <button type="button" className="likhari-spell-word" onClick={() => select(item)}>
                {item.word}
              </button>
              {item.suggestions.map((s) => (
                <button key={s} type="button" className="likhari-spell-suggestion" onClick={() => replace(item, s)}>
                  {s}
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
