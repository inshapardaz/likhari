import type { EditorRootProps, Locale, ToolbarStyle } from '@inshapardaz/likhari-react';
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
  'toolbar-bordered',
  'toolbar-variant',
  'help-url',
] as const;

const LOCALES: Locale[] = ['en', 'ur', 'pa-shahmukhi'];
const PRESETS: FeatureConfigPresetName[] = ['minimal', 'standard', 'full', 'poetry'];
const TOOLBAR_VARIANTS: NonNullable<ToolbarStyle['variant']>[] = ['light', 'filled'];

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

  const toolbarBordered = booleanAttribute(read('toolbar-bordered'));
  const toolbarVariant = read('toolbar-variant');
  const variant = toolbarVariant && (TOOLBAR_VARIANTS as string[]).includes(toolbarVariant) ? (toolbarVariant as ToolbarStyle['variant']) : undefined;
  if (toolbarBordered !== undefined || variant !== undefined) {
    props.toolbarStyle = {
      ...(toolbarBordered !== undefined && { bordered: toolbarBordered }),
      ...(variant !== undefined && { variant }),
    };
  }

  const helpUrl = read('help-url');
  if (helpUrl === 'false') props.helpUrl = false;
  else if (helpUrl !== null) props.helpUrl = helpUrl;

  return props;
}
