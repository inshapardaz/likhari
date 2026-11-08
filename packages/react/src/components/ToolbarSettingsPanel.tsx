import { IconX } from '@tabler/icons-react';
import type { Strings } from '../i18n/strings';
import type { ToolbarVisibilityGroup } from '../toolbar/toolbarVisibility';

/**
 * Lets the user show or hide individual toolbar buttons and dropdowns, grouped
 * the way they appear in the toolbar. The choice is read from and saved to
 * localStorage by the caller (`useToolbarItemVisibility`); this component only
 * renders the checkboxes and reports clicks.
 */
export function ToolbarSettingsPanel({
  strings,
  dir,
  groups,
  isHidden,
  onToggle,
  onClose,
}: {
  strings: Strings;
  dir: 'ltr' | 'rtl';
  groups: ToolbarVisibilityGroup[];
  isHidden: (id: string) => boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const t = strings.toolbarSettings;
  return (
    <div className="likhari-toolbar-settings-panel" role="region" aria-label={t.title} dir={dir}>
      <div className="likhari-spell-header">
        <strong>{t.title}</strong>
        <button type="button" className="likhari-spell-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
      <div className="likhari-toolbar-settings-groups">
        {groups.map((group) => (
          <fieldset key={group.id} className="likhari-toolbar-settings-group">
            <legend>{group.label}</legend>
            {group.items.map((item) => (
              <label key={item.id} className="likhari-toolbar-settings-item">
                <input type="checkbox" checked={!isHidden(item.id)} onChange={() => onToggle(item.id)} />
                {item.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
