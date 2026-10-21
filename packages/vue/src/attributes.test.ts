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
      'toolbar-bordered': null,
      'toolbar-variant': null,
      'toolbar-layout': null,
      'help-url': null,
      'font-mode': null,
      'font-family': null,
      zoom: null,
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

  it('passes a custom help URL through, and writes "false" to hide the button', () => {
    expect(toElementAttributes({ helpUrl: 'https://example.com/docs' })['help-url']).toBe('https://example.com/docs');
    expect(toElementAttributes({ helpUrl: false })['help-url']).toBe('false');
    expect(toElementAttributes({})['help-url']).toBeNull();
  });

  it('writes the toolbar layout, and leaves it unset when absent', () => {
    expect(toElementAttributes({ toolbarLayout: 'ribbon' })['toolbar-layout']).toBe('ribbon');
    expect(toElementAttributes({ toolbarLayout: 'classic' })['toolbar-layout']).toBe('classic');
    expect(toElementAttributes({})['toolbar-layout']).toBeNull();
  });

  it('writes the uniform font settings, and leaves them unset when absent', () => {
    const attrs = toElementAttributes({ fontMode: 'uniform', fontFamily: 'Amiri', zoom: 150 });
    expect(attrs['font-mode']).toBe('uniform');
    expect(attrs['font-family']).toBe('Amiri');
    expect(attrs.zoom).toBe('150');
    const unset = toElementAttributes({});
    expect(unset['font-mode']).toBeNull();
    expect(unset['font-family']).toBeNull();
    expect(unset.zoom).toBeNull();
  });
});
