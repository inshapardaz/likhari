import { describe, expect, it } from 'vitest';
import { toElementAttributes } from './attributes';

describe('toElementAttributes', () => {
  it('maps props to the Web Component attributes, removing unset ones', () => {
    expect(toElementAttributes({ documentId: 'doc-1', locale: 'ur', height: '60vh' })).toEqual({
      'document-id': 'doc-1',
      locale: 'ur',
      'color-scheme': null,
      'accent-color': null,
      placeholder: null,
      height: '60vh',
      'show-save': null,
      autosave: null,
      'feature-preset': null,
    });
  });

  it('writes a true boolean as present and a false one as "false"', () => {
    const on = toElementAttributes({ showSave: true, autosave: true });
    const off = toElementAttributes({ showSave: false, autosave: false });
    expect(on['show-save']).toBe('');
    expect(on.autosave).toBe('');
    expect(off['show-save']).toBe('false');
    expect(off.autosave).toBe('false');
  });

  it('passes the feature preset through', () => {
    expect(toElementAttributes({ featurePreset: 'poetry' })['feature-preset']).toBe('poetry');
  });
});
