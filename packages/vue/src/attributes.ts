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
  toolbarBordered?: boolean;
  toolbarVariant?: 'light' | 'filled';
  /** The toolbar's Help button opens this URL. `false` hides the button. */
  helpUrl?: string | false;
  /** `'uniform'`: one font for all text and a zoom control, instead of per-selection font and size. */
  fontMode?: 'selective' | 'uniform';
  /** Uniform mode: the font family for all text. */
  fontFamily?: string;
  /** Uniform mode: zoom as a percentage, 50–300. */
  zoom?: number;
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
    'toolbar-bordered': props.toolbarBordered === undefined ? null : props.toolbarBordered ? '' : 'false',
    'toolbar-variant': props.toolbarVariant ?? null,
    'help-url': props.helpUrl === undefined ? null : props.helpUrl === false ? 'false' : props.helpUrl,
    'font-mode': props.fontMode ?? null,
    'font-family': props.fontFamily ?? null,
    zoom: props.zoom === undefined ? null : String(props.zoom),
  };
}
