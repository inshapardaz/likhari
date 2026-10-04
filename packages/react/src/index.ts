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
export { localStorageAutoCorrectStore, apiAutoCorrectStore, fileAutoCorrectStore } from './autocorrect/autoCorrectStores';
export type { AutoCorrectStore, AutoCorrectEntry } from './autocorrect/autoCorrectStores';
export { normalizeUrdu, normalizeUrduCharacters, removeUrduDiacritics, replaceUrduDigits } from './normalization/urduNormalize';
export type { UrduNormalizationOptions } from './normalization/urduNormalize';
export type { PunctuationOptions, PunctuationRule } from './autocorrect/punctuationRules';
export { localStorageUserWordStore, apiUserWordStore, ignoreWord, addUserWord, onSpellWordsChange } from './spellcheck/userWords';
export type { UserWordStore } from './spellcheck/userWords';
