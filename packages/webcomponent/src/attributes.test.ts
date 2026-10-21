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

  it('reads the toolbar layout, ignoring anything but classic and ribbon', () => {
    expect(attributesToProps(from({ 'toolbar-layout': 'ribbon' }))).toEqual({ toolbarStyle: { layout: 'ribbon' } });
    expect(attributesToProps(from({ 'toolbar-layout': 'classic', 'toolbar-bordered': 'false' }))).toEqual({
      toolbarStyle: { bordered: false, layout: 'classic' },
    });
    expect(attributesToProps(from({ 'toolbar-layout': 'tabs' }))).toEqual({});
  });

  it('keeps an empty placeholder, which means no placeholder text', () => {
    expect(attributesToProps(from({ placeholder: '' }))).toEqual({ placeholder: '' });
  });

  it('reads the help URL, including hiding the button with "false"', () => {
    expect(attributesToProps(from({ 'help-url': 'https://example.com/docs' }))).toEqual({ helpUrl: 'https://example.com/docs' });
    expect(attributesToProps(from({ 'help-url': 'false' }))).toEqual({ helpUrl: false });
    expect(attributesToProps(from({}))).toEqual({});
  });

  it('reads the uniform font mode, font family and zoom', () => {
    expect(attributesToProps(from({ 'font-mode': 'uniform', 'font-family': '"Amiri", serif', zoom: '125' }))).toEqual({
      fontMode: 'uniform',
      fontFamily: '"Amiri", serif',
      zoom: 125,
    });
  });

  it('ignores an unknown font mode and a zoom that is not a number', () => {
    expect(attributesToProps(from({ 'font-mode': 'huge', zoom: 'big' }))).toEqual({});
    expect(attributesToProps(from({ zoom: '' }))).toEqual({});
  });
});
