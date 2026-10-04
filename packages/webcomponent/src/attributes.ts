import type { EditorRootProps, Locale } from '@inshapardaz/likhari-react';
import type { FeatureConfigPresetName } from '@inshapardaz/likhari-core';

/** The HTML attributes the element reads, in kebab-case as written in markup. */
export const OBSERVED_ATTRIBUTES = [
  'document-id',
  'locale',
  'color-scheme',
  'accent-color',
  'placeholder',
  'height',
  'show-save',
  'autosave',
  'feature-preset',
] as const;

const LOCALES: Locale[] = ['en', 'ur', 'pa-shahmukhi'];
const PRESETS: FeatureConfigPresetName[] = ['minimal', 'standard', 'full', 'poetry'];

/** A boolean attribute is on when present, unless it says "false". */
function booleanAttribute(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value !== 'false';
}

/**
 * Turns the element's attributes into editor props. Unknown or invalid values are
 * left out, so the editor's defaults apply.
 */
export function attributesToProps(read: (name: string) => string | null): Partial<EditorRootProps> {
  const props: Partial<EditorRootProps> = {};

  const documentId = read('document-id');
  if (documentId) props.documentId = documentId;

  const locale = read('locale');
  if (locale && (LOCALES as string[]).includes(locale)) props.locale = locale as Locale;

  const colorScheme = read('color-scheme');
  if (colorScheme === 'light' || colorScheme === 'dark') props.colorScheme = colorScheme;

  const accentColor = read('accent-color');
  if (accentColor) props.accentColor = accentColor;

  const placeholder = read('placeholder');
  if (placeholder !== null) props.placeholder = placeholder;

  const height = read('height');
  if (height) props.height = height;

  const showSave = booleanAttribute(read('show-save'));
  if (showSave !== undefined) props.showSave = showSave;

  const autosave = booleanAttribute(read('autosave'));
  if (autosave !== undefined) props.autosave = autosave;

  const preset = read('feature-preset');
  if (preset && (PRESETS as string[]).includes(preset)) props.featurePreset = preset as FeatureConfigPresetName;

  return props;
}
