export { EditorRoot } from './EditorRoot';
export type { EditorRootProps, EditorRef, EditorInitialContent, NavigationGuardMode } from './EditorRoot';
export type { DraftRestoreMode } from './components/DraftRestore';
export { defaultMantineTheme } from './theme/mantineTheme';
export { ImageNode, $createImageNode, $isImageNode } from './image/ImageNode';
export type { ImagePayload, ImageLinkType, SerializedImageNode } from './image/ImageNode';
export { DEFAULT_FONT_OPTIONS, URDU_WEB_FONT_OPTIONS, FONT_SIZES_PX } from './fonts';
export type { FontOption } from './fonts';
export { STRINGS, getStrings, useStrings, useUiStrings, UiStringsContext } from './i18n';
export type { Locale, Strings } from './i18n';

export { registerSpellDictionary, hasSpellDictionary, type HunspellFiles, type SpellLanguage } from './spellcheck/spellDictionaries';
