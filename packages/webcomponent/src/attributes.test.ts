import { describe, expect, it } from 'vitest';
import { attributesToProps } from './attributes';

const from = (attrs: Record<string, string>) => (name: string) => (name in attrs ? attrs[name] : null);

describe('attributesToProps', () => {
  it('reads valid simple settings', () => {
    expect(
      attributesToProps(
        from({ 'document-id': 'doc-1', locale: 'ur', 'color-scheme': 'dark', 'accent-color': '#2B6E6E', height: '60vh', placeholder: 'Write…' }),
      ),
    ).toEqual({ documentId: 'doc-1', locale: 'ur', colorScheme: 'dark', accentColor: '#2B6E6E', height: '60vh', placeholder: 'Write…' });
  });

  it('drops invalid values so the editor defaults apply', () => {
    expect(attributesToProps(from({ locale: 'fr', 'color-scheme': 'auto', 'feature-preset': 'huge' }))).toEqual({});
  });

  it('treats a boolean attribute as on when present, unless it says false', () => {
    expect(attributesToProps(from({ 'show-save': '' }))).toEqual({ showSave: true });
    expect(attributesToProps(from({ 'show-save': 'false' }))).toEqual({ showSave: false });
    expect(attributesToProps(from({}))).toEqual({});
  });

  it('reads the feature preset and autosave', () => {
    expect(attributesToProps(from({ 'feature-preset': 'poetry', autosave: 'false' }))).toEqual({
      featurePreset: 'poetry',
      autosave: false,
    });
  });

  it('reads the toolbar style', () => {
    expect(attributesToProps(from({ 'toolbar-bordered': 'false', 'toolbar-variant': 'filled' }))).toEqual({
      toolbarStyle: { bordered: false, variant: 'filled' },
    });
    expect(attributesToProps(from({ 'toolbar-bordered': '' }))).toEqual({ toolbarStyle: { bordered: true } });
    expect(attributesToProps(from({ 'toolbar-variant': 'outline' }))).toEqual({});
  });

  it('keeps an empty placeholder, which means no placeholder text', () => {
    expect(attributesToProps(from({ placeholder: '' }))).toEqual({ placeholder: '' });
  });
});
