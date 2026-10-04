import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import type { Strings } from '../i18n/strings';
import { appendAutoCorrection, type AutoCorrectStore } from '../autocorrect/autoCorrectStores';
import type { SpellLanguage } from '../spellcheck/spellDictionaries';

const LANGUAGES: { value: SpellLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
  { value: 'pa-shahmukhi', label: 'پنجابی (شاہ مکھی)' },
];

/**
 * Adds one correction (a typed word and its replacement) to the first store
 * that accepts writes. Saving bumps the editor's correction version, so the new
 * entry applies to the next word the user types.
 */
export function AutoCorrectPanel({
  strings,
  dir,
  stores,
  onSaved,
  onClose,
}: {
  strings: Strings;
  dir: 'ltr' | 'rtl';
  stores: AutoCorrectStore[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const t = strings.autoCorrect;
  const [language, setLanguage] = useState<SpellLanguage>('en');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'nowhere' | 'failed'>('idle');

  const save = async () => {
    const entry = { from: from.trim(), to: to.trim() };
    if (entry.from === '' || entry.to === '' || entry.from === entry.to) return;
    try {
      const written = await appendAutoCorrection(stores, language, entry);
      if (!written) {
        setStatus('nowhere');
        return;
      }
      setStatus('saved');
      setFrom('');
      setTo('');
      onSaved();
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="likhari-autocorrect-panel" role="region" aria-label={t.title} dir={dir}>
      <div className="likhari-spell-header">
        <strong>{t.title}</strong>
        <button type="button" className="likhari-spell-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
      <label className="likhari-autocorrect-field">
        {t.language}
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as SpellLanguage);
            setStatus('idle');
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="likhari-autocorrect-field">
        {t.from}
        <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t.fromPlaceholder} />
      </label>
      <label className="likhari-autocorrect-field">
        {t.to}
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t.toPlaceholder} />
      </label>
      <div className="likhari-autocorrect-actions">
        <button type="button" onClick={save} disabled={from.trim() === '' || to.trim() === ''}>
          {t.save}
        </button>
        <span className="likhari-spell-note" aria-live="polite">
          {status === 'saved' && t.saved}
          {status === 'nowhere' && t.noWritableStore}
          {status === 'failed' && t.failed}
        </span>
      </div>
    </div>
  );
}
