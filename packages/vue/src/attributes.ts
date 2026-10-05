/** The component's props that the Web Component reads as attributes. */
export interface LikhariEditorProps {
  documentId?: string;
  locale?: string;
  colorScheme?: 'light' | 'dark';
  accentColor?: string;
  placeholder?: string;
  height?: string;
  showSave?: boolean;
  autosave?: boolean;
  featurePreset?: 'minimal' | 'standard' | 'full' | 'poetry';
}

/**
 * The attribute value for each prop, as the Web Component reads it. `null` removes
 * the attribute, so an unset prop falls back to the editor's default. A boolean is
 * written as "present" when true and "false" when false.
 */
export function toElementAttributes(props: LikhariEditorProps): Record<string, string | null> {
  return {
    'document-id': props.documentId ?? null,
    locale: props.locale ?? null,
    'color-scheme': props.colorScheme ?? null,
    'accent-color': props.accentColor ?? null,
    placeholder: props.placeholder ?? null,
    height: props.height ?? null,
    'show-save': props.showSave === undefined ? null : props.showSave ? '' : 'false',
    autosave: props.autosave === undefined ? null : props.autosave ? '' : 'false',
    'feature-preset': props.featurePreset ?? null,
  };
}
