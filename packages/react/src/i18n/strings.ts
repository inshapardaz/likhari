/**
 * UI localization strings for the editor's own chrome (toolbar, dialogs,
 * menus, placeholders) — see docs/lexical-editor-spec.md §3.2. This is
 * separate from content direction/fonts (handled in EditorRoot) and from
 * Markdown/HTML/plain-text format translation, which is out of scope here.
 */

/** Re-exported from EditorRoot's existing prop type so there is a single
 * source of truth for which locales the editor knows about. */
export type Locale = 'en' | 'ur' | 'pa-shahmukhi';

export interface Strings {
  editor: {
    /** Default placeholder shown in an empty editor (overridden by an explicit `placeholder` prop). */
    placeholder: string;
    /** aria-label on the contenteditable itself. */
    contentLabel: string;
    /** Label shown on a page-break marker's dashed line while editing. */
    pageBreakLabel: string;
  };
  common: {
    cancel: string;
    save: string;
    insert: string;
  };
  toolbar: {
    /** aria-label on the toolbar's own role="toolbar" container. */
    ariaLabel: string;
    save: string;
    /** Opens the list of autosaved drafts. */
    drafts: string;
    undo: string;
    redo: string;
    formattingLabel: string;
    bold: string;
    italic: string;
    underline: string;
    fontFamily: string;
    fontFamilyPlaceholder: string;
    fontSize: string;
    fontSizePlaceholder: string;
    noMatch: string;
    alignment: string;
    linkOptions: string;
    /** Toolbar button (shown while the caret is in a table) that opens the table actions menu. */
    tableOptions: string;
    /** Toolbar button (shown while the caret is in a couplet) that opens the poetry layout/alignment menu. */
    poetryOptions: string;
    insertLink: string;
    insertImage: string;
    insertPageBreak: string;
    insertTable: string;
    insertColumns: string;
    insertFootnote: string;
    insertPoetryCouplet: string;
    insertHorizontalRule: string;
    comingSoon: (label: string) => string;
    autocorrect: string;
    textCleanup: string;
    spellChecker: string;
    moreFormatting: string;
    strikethrough: string;
    superscript: string;
    subscript: string;
    uppercase: string;
    lowercase: string;
    capitalize: string;
    clearFormatting: string;
    outdent: string;
    indent: string;
    formattingOptions: {
      paragraph: string;
      heading: (level: number) => string;
      numberedList: string;
      bulletList: string;
      taskList: string;
      quote: string;
    };
    alignOptions: {
      start: string;
      center: string;
      end: string;
      justify: string;
      left: string;
      right: string;
    };
  };
  /** The popup `EditorRef.confirmDiscard()` shows when the user is about to leave with unsaved changes (lexical-editor-spec.md §6.4). */
  leaveDialog: {
    title: string;
    message: string;
    save: string;
    saveDraft: string;
    discard: string;
    /** Shown when a draft could not be stored (document too large, or storage unavailable). */
    saveDraftFailed: string;
  };
  /** Autosave drafts (lexical-editor-spec.md §6.2): the restore banner and the drafts list dialog. */
  drafts: {
    /** Banner shown when a newer unsaved draft of this document is found; `when` is a formatted date/time. */
    bannerMessage: (when: string) => string;
    restore: string;
    ignore: string;
    remove: string;
    dialogTitle: string;
    intro: string;
    empty: string;
    /** Shown for a draft with no text (e.g. only an image). */
    noText: string;
    thisDocument: string;
    untitled: string;
    documentLabel: (id: string) => string;
    earlierUntitled: string;
    earlierVersionOf: (id: string) => string;
    savedAt: (when: string) => string;
    size: (kb: number) => string;
    replacePrompt: string;
    replace: string;
    deletePrompt: string;
    delete: string;
    close: string;
  };
  /** The table actions menu (toolbar button and right-click on a cell). */
  tableMenu: {
    menuLabel: string;
    insertRowBefore: string;
    insertRowAfter: string;
    insertColumnBefore: string;
    insertColumnAfter: string;
    deleteRow: string;
    deleteColumn: string;
    deleteTable: string;
    /** Plural forms, used when the selection spans several rows or columns. */
    insertRowsBefore: string;
    insertRowsAfter: string;
    insertColumnsBefore: string;
    insertColumnsAfter: string;
    deleteRows: string;
    deleteColumns: string;
    mergeCells: string;
    unmergeCell: string;
  };
  poetryMenu: {
    menuLabel: string;
    singleColumn: string;
    twoColumn: string;
    staggered: string;
    narrowerCouplets: string;
    widerCouplets: string;
    insertCoupletBefore: string;
    insertCoupletAfter: string;
    centerCouplet: string;
    uncenterCouplet: string;
    tighterSpacing: string;
    looserSpacing: string;
    narrowerGutter: string;
    widerGutter: string;
    deleteCouplet: string;
    deletePoetry: string;
  };
  findReplace: {
    toggle: string;
    find: string;
    replace: string;
    findPlaceholder: string;
    replacePlaceholder: string;
    previous: string;
    next: string;
    replaceOne: string;
    replaceAll: string;
    noMatches: string;
    close: string;
  },
  spellcheck: {
    title: string;
    language: string;
    check: string;
    close: string;
    noMisspellings: string;
    previous: string;
    next: string;
    noSuggestions: string;
  },
  autoCorrect: {
    title: string;
    language: string;
    from: string;
    fromPlaceholder: string;
    to: string;
    toPlaceholder: string;
    save: string;
    saved: string;
    noWritableStore: string;
    failed: string;
    close: string;
    correctDocument: string;
  },
  contextMenu: {
    cut: string;
    copy: string;
    paste: string;
    selectAll: string;
    ignore: string;
    addToDictionary: string;
    addToAutoCorrect: string;
    spelling: string;
    noSuggestions: string;
  },
  autoComplete: {
    label: string;
  },
  link: {
    menuLabel: string;
    noUrl: string;
    editLink: string;
    removeLink: string;
  };
  linkDialog: {
    titleInsert: string;
    titleEdit: string;
    urlLabel: string;
    urlPlaceholder: string;
    textLabel: string;
    textPlaceholder: string;
    invalidUrl: string;
    apply: string;
  };
  tableDialog: {
    title: string;
    rows: string;
    columns: string;
    headerRow: string;
  };
  layoutDialog: {
    title: string;
    columnCount: string;
  };
  imageDialog: {
    titleInsert: string;
    titleEdit: string;
    currentImage: string;
    fromUrl: string;
    upload: string;
    embeddedInDocument: string;
    linkedFrom: (src: string) => string;
    convertButton: string;
    convertHint: string;
    imageUrlLabel: string;
    imageUrlPlaceholder: string;
    embedCopyLabel: string;
    embedCopyDescription: string;
    convertedFromUrl: string;
    fileLabel: string;
    filePlaceholder: string;
    fileDescription: (maxSizeMB: number, storedInDocument: boolean) => string;
    altTextLabel: string;
    altTextDescription: string;
    captionLabel: string;
    captionDescription: string;
    errors: {
      enterUrl: string;
      chooseFile: string;
      noImage: string;
      uploadUnusable: string;
      couldNotSave: string;
      couldNotConvert: string;
      couldNotReadFile: string;
      largerThan: (maxSizeMB: number) => string;
    };
  };
  imageCropDialog: {
    title: string;
    sizeLabel: string;
    widthLabel: string;
    heightLabel: string;
    autoPlaceholder: string;
    keepProportions: string;
    originalSize: string;
    dragHint: (natural: { width: number; height: number } | null) => string;
    errors: {
      uploadUnusable: string;
      couldNotSave: string;
      largerThan: (maxSizeMB: number) => string;
    };
  };
  imageMenu: {
    editImage: string;
    convertToEmbedded: string;
    cropResize: string;
    addCaption: string;
    editCaption: string;
    removeCaption: string;
    deleteImage: string;
    resizeImage: string;
  };
}

const en: Strings = {
  editor: {
    placeholder: 'Start writing…',
    contentLabel: 'Editor content',
    pageBreakLabel: 'Page break',
  },
  common: {
    cancel: 'Cancel',
    save: 'Save',
    insert: 'Insert',
  },
  toolbar: {
    ariaLabel: 'Formatting',
    save: 'Save',
    drafts: 'Drafts',
    undo: 'Undo',
    redo: 'Redo',
    formattingLabel: 'Formatting',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    fontFamily: 'Font family',
    fontFamilyPlaceholder: 'Font',
    fontSize: 'Font size',
    fontSizePlaceholder: 'Size',
    noMatch: 'No match',
    alignment: 'Alignment',
    linkOptions: 'Link options',
    tableOptions: 'Table options',
    poetryOptions: 'Poetry options',
    insertLink: 'Insert link (Ctrl+K)',
    insertImage: 'Insert image',
    insertPageBreak: 'Insert page break',
    insertTable: 'Insert table',
    insertColumns: 'Insert columns',
    insertFootnote: 'Insert footnote',
    insertPoetryCouplet: 'Insert poetry couplet',
    insertHorizontalRule: 'Insert horizontal rule',
    comingSoon: (label) => `${label} (coming soon)`,
    autocorrect: 'Auto-correct',
    textCleanup: 'Text cleanup',
    spellChecker: 'Spell-checker',
    moreFormatting: 'More formatting',
    strikethrough: 'Strikethrough',
    superscript: 'Superscript',
    subscript: 'Subscript',
    uppercase: 'UPPERCASE',
    lowercase: 'lowercase',
    capitalize: 'Capitalize',
    clearFormatting: 'Clear formatting',
    outdent: 'Outdent',
    indent: 'Indent',
    formattingOptions: {
      paragraph: 'Paragraph',
      heading: (level) => `Heading ${level}`,
      numberedList: 'Numbered list',
      bulletList: 'Bullet list',
      taskList: 'Task list',
      quote: 'Quote',
    },
    alignOptions: {
      start: 'Align start',
      center: 'Align center',
      end: 'Align end',
      justify: 'Justify',
      left: 'Align left',
      right: 'Align right',
    },
  },
  leaveDialog: {
    title: 'Unsaved changes',
    message: 'You have unsaved changes. What would you like to do before leaving?',
    save: 'Save',
    saveDraft: 'Save draft',
    discard: 'Discard',
    saveDraftFailed: "The draft couldn't be saved (the document may be too large, or browser storage is unavailable).",
  },
  drafts: {
    bannerMessage: (when) => `An unsaved draft of this document from ${when} was found.`,
    restore: 'Restore',
    ignore: 'Ignore',
    remove: 'Remove draft',
    dialogTitle: 'Saved drafts',
    intro: 'Drafts are saved in this browser as you type, and removed when you save.',
    empty: 'No drafts yet.',
    noText: '(no text)',
    thisDocument: 'Current document',
    untitled: 'Untitled draft',
    documentLabel: (id) => `Document “${id}”`,
    earlierUntitled: 'Earlier version of an untitled draft',
    earlierVersionOf: (id) => `Earlier version of “${id}”`,
    savedAt: (when) => `Saved ${when}`,
    size: (kb) => `${kb} KB`,
    replacePrompt: 'Replace the current content with this draft?',
    replace: 'Replace',
    deletePrompt: 'Delete this draft?',
    delete: 'Delete',
    close: 'Close',
  },
  tableMenu: {
    menuLabel: 'Table',
    insertRowBefore: 'Insert row before',
    insertRowAfter: 'Insert row after',
    insertColumnBefore: 'Insert column before',
    insertColumnAfter: 'Insert column after',
    deleteRow: 'Delete row',
    deleteColumn: 'Delete column',
    deleteTable: 'Delete table',
    insertRowsBefore: 'Insert rows before',
    insertRowsAfter: 'Insert rows after',
    insertColumnsBefore: 'Insert columns before',
    insertColumnsAfter: 'Insert columns after',
    deleteRows: 'Delete rows',
    deleteColumns: 'Delete columns',
    mergeCells: 'Merge cells',
    unmergeCell: 'Unmerge cell',
  },
  poetryMenu: {
    menuLabel: 'Poetry',
    singleColumn: 'Single column',
    twoColumn: 'Two column',
    staggered: 'Alternating sides',
    narrowerCouplets: 'Narrower couplets',
    widerCouplets: 'Wider couplets',
    insertCoupletBefore: 'Insert couplet above',
    insertCoupletAfter: 'Insert couplet below',
    centerCouplet: 'Center this couplet',
    uncenterCouplet: 'Un-center this couplet',
    tighterSpacing: 'Tighter couplet spacing',
    looserSpacing: 'Looser couplet spacing',
    narrowerGutter: 'Narrower gutter',
    widerGutter: 'Wider gutter',
    deleteCouplet: 'Delete couplet',
    deletePoetry: 'Delete poetry',
  },
  findReplace: {
    toggle: 'Find and replace',
    find: 'Find',
    replace: 'Replace',
    findPlaceholder: 'Text to find',
    replacePlaceholder: 'Replacement text',
    previous: 'Previous',
    next: 'Next',
    replaceOne: 'Replace',
    replaceAll: 'Replace all',
    noMatches: 'No matches',
    close: 'Close',
  },
  spellcheck: {
    title: 'Spell check',
    language: 'Language',
    check: 'Check',
    close: 'Close',
    noMisspellings: 'No misspellings found',
    previous: 'Previous',
    next: 'Next',
    noSuggestions: 'No suggestions',
  },
  autoCorrect: {
    title: 'Auto-correct',
    language: 'Language',
    from: 'Typed word',
    fromPlaceholder: 'Word as typed',
    to: 'Corrected word',
    toPlaceholder: 'Correct it to',
    save: 'Save correction',
    saved: 'Saved. It applies to the next word typed.',
    noWritableStore: 'No store accepts new corrections',
    failed: 'Could not save the correction',
    close: 'Close',
    correctDocument: 'Correct whole document',
  },
  contextMenu: {
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select all',
    ignore: 'Ignore',
    addToDictionary: 'Add to dictionary',
    addToAutoCorrect: 'Add to auto-correct',
    spelling: 'Spelling suggestions',
    noSuggestions: 'No suggestions',
  },
  autoComplete: {
    label: 'Suggestions',
  },
  link: {
    menuLabel: 'Link',
    noUrl: '(no URL)',
    editLink: 'Edit link',
    removeLink: 'Remove link',
  },
  linkDialog: {
    titleInsert: 'Insert link',
    titleEdit: 'Edit link',
    urlLabel: 'URL',
    urlPlaceholder: 'https://example.com',
    textLabel: 'Text',
    textPlaceholder: 'Link text (defaults to the URL)',
    invalidUrl: 'Enter a valid http(s), mailto, tel or relative URL',
    apply: 'Apply',
  },
  tableDialog: {
    title: 'Insert table',
    rows: 'Rows',
    columns: 'Columns',
    headerRow: 'Header row',
  },
  layoutDialog: {
    title: 'Insert columns',
    columnCount: 'Number of columns',
  },
  imageDialog: {
    titleInsert: 'Insert image',
    titleEdit: 'Edit image',
    currentImage: 'Current image',
    fromUrl: 'From URL',
    upload: 'Upload',
    embeddedInDocument: 'Embedded in the document',
    linkedFrom: (src) => `Linked from ${src}`,
    convertButton: 'Convert to embedded image',
    convertHint: 'Downloads a copy into the document, so it can be cropped, rotated and resized.',
    imageUrlLabel: 'Image URL',
    imageUrlPlaceholder: 'https://example.com/photo.jpg',
    embedCopyLabel: 'Embed a copy in the document',
    embedCopyDescription: 'Downloads the image so it can be edited and no longer depends on the URL.',
    convertedFromUrl: 'Converted from the URL: a copy will be embedded in the document.',
    fileLabel: 'Image file',
    filePlaceholder: 'Choose an image',
    fileDescription: (maxSizeMB, storedInDocument) => `Up to ${maxSizeMB} MB${storedInDocument ? '; stored inside the document' : ''}`,
    altTextLabel: 'Alt text',
    altTextDescription: 'Describes the image for screen readers',
    captionLabel: 'Caption',
    captionDescription: 'Shown under the image. Leave empty for none.',
    errors: {
      enterUrl: 'Enter an http(s) or relative image URL',
      chooseFile: 'Choose an image file',
      noImage: 'No image',
      uploadUnusable: 'The upload handler returned an unusable image URL',
      couldNotSave: 'Could not save the image',
      couldNotConvert: 'Could not convert the image',
      couldNotReadFile: 'Could not read the file',
      largerThan: (maxSizeMB) => `Image is larger than ${maxSizeMB} MB`,
    },
  },
  imageCropDialog: {
    title: 'Crop & resize',
    sizeLabel: 'Size',
    widthLabel: 'Width (px)',
    heightLabel: 'Height (px)',
    autoPlaceholder: 'Auto',
    keepProportions: 'Keep proportions',
    originalSize: 'Original size',
    dragHint: (natural) =>
      `You can also drag the corner handle on a selected image. ${natural ? `Original: ${natural.width} × ${natural.height} px.` : ''}`,
    errors: {
      uploadUnusable: 'The upload handler returned an unusable image URL',
      couldNotSave: 'Could not save the image',
      largerThan: (maxSizeMB) => `Image is larger than ${maxSizeMB} MB`,
    },
  },
  imageMenu: {
    editImage: 'Edit image…',
    convertToEmbedded: 'Convert to embedded image',
    cropResize: 'Crop & resize…',
    addCaption: 'Add caption…',
    editCaption: 'Edit caption…',
    removeCaption: 'Remove caption',
    deleteImage: 'Delete image',
    resizeImage: 'Resize image',
  },
};

const ur: Strings = {
  editor: {
    placeholder: 'لکھنا شروع کریں…',
    contentLabel: 'ایڈیٹر کا مواد',
    pageBreakLabel: 'صفحے کی تقسیم',
  },
  common: {
    cancel: 'منسوخ کریں',
    save: 'محفوظ کریں',
    insert: 'شامل کریں',
  },
  toolbar: {
    ariaLabel: 'فارمیٹنگ',
    save: 'محفوظ کریں',
    drafts: 'مسودے',
    undo: 'کالعدم کریں',
    redo: 'دوبارہ کریں',
    formattingLabel: 'فارمیٹنگ',
    bold: 'موٹا',
    italic: 'ترچھا',
    underline: 'زیرِ خط',
    fontFamily: 'فونٹ کا خاندان',
    fontFamilyPlaceholder: 'فونٹ',
    fontSize: 'فونٹ کا سائز',
    fontSizePlaceholder: 'سائز',
    noMatch: 'کوئی مماثلت نہیں',
    alignment: 'سیدھ',
    linkOptions: 'لنک کے اختیارات',
    tableOptions: 'جدول کے اختیارات',
    poetryOptions: 'شاعری کے اختیارات',
    insertLink: 'لنک شامل کریں (Ctrl+K)',
    insertImage: 'تصویر شامل کریں',
    insertPageBreak: 'صفحے کی تقسیم شامل کریں',
    insertTable: 'جدول شامل کریں',
    insertColumns: 'کالم شامل کریں',
    insertFootnote: 'فٹ نوٹ شامل کریں',
    insertPoetryCouplet: 'شعر شامل کریں',
    insertHorizontalRule: 'افقی لکیر شامل کریں',
    comingSoon: (label) => `${label} (جلد آ رہا ہے)`,
    autocorrect: 'خودکار تصحیح',
    textCleanup: 'متن کی صفائی',
    spellChecker: 'ہجے چیک کرنے والا',
    moreFormatting: 'مزید فارمیٹنگ',
    strikethrough: 'خط زدہ',
    superscript: 'بالا نویس',
    subscript: 'زیریں نویس',
    uppercase: 'بڑے حروف',
    lowercase: 'چھوٹے حروف',
    capitalize: 'پہلا حرف بڑا',
    clearFormatting: 'فارمیٹنگ ختم کریں',
    outdent: 'حاشیہ کم کریں',
    indent: 'حاشیہ بڑھائیں',
    formattingOptions: {
      paragraph: 'پیراگراف',
      heading: (level) => `عنوان ${level}`,
      numberedList: 'نمبردار فہرست',
      bulletList: 'بلٹ فہرست',
      taskList: 'ٹاسک فہرست',
      quote: 'اقتباس',
    },
    alignOptions: {
      start: 'ابتدائی سیدھ',
      center: 'درمیانی سیدھ',
      end: 'اختتامی سیدھ',
      justify: 'دو طرفہ سیدھ',
      left: 'بائیں سیدھ',
      right: 'دائیں سیدھ',
    },
  },
  leaveDialog: {
    title: 'غیر محفوظ شدہ تبدیلیاں',
    message: 'آپ کی تبدیلیاں محفوظ نہیں ہوئیں۔ جانے سے پہلے آپ کیا کرنا چاہیں گے؟',
    save: 'محفوظ کریں',
    saveDraft: 'مسودہ محفوظ کریں',
    discard: 'رد کریں',
    saveDraftFailed: 'مسودہ محفوظ نہیں ہو سکا (دستاویز بہت بڑی ہو سکتی ہے، یا براؤزر کا اسٹوریج دستیاب نہیں)۔',
  },
  drafts: {
    bannerMessage: (when) => `اس دستاویز کا ایک غیر محفوظ شدہ مسودہ (${when}) ملا ہے۔`,
    restore: 'بحال کریں',
    ignore: 'نظر انداز کریں',
    remove: 'مسودہ ہٹائیں',
    dialogTitle: 'محفوظ شدہ مسودے',
    intro: 'لکھتے وقت مسودے اس براؤزر میں خود بخود محفوظ ہوتے ہیں اور محفوظ کرنے پر ہٹا دیے جاتے ہیں۔',
    empty: 'ابھی کوئی مسودہ نہیں۔',
    noText: '(کوئی متن نہیں)',
    thisDocument: 'موجودہ دستاویز',
    untitled: 'بلا عنوان مسودہ',
    documentLabel: (id) => `دستاویز «${id}»`,
    earlierUntitled: 'ایک بلا عنوان مسودے کا پرانا ورژن',
    earlierVersionOf: (id) => `«${id}» کا پرانا ورژن`,
    savedAt: (when) => `محفوظ شدہ: ${when}`,
    size: (kb) => `${kb} کے بی`,
    replacePrompt: 'موجودہ مواد کو اس مسودے سے بدل دیں؟',
    replace: 'بدل دیں',
    deletePrompt: 'یہ مسودہ حذف کریں؟',
    delete: 'حذف کریں',
    close: 'بند کریں',
  },
  tableMenu: {
    menuLabel: 'جدول',
    insertRowBefore: 'پہلے قطار شامل کریں',
    insertRowAfter: 'بعد میں قطار شامل کریں',
    insertColumnBefore: 'پہلے کالم شامل کریں',
    insertColumnAfter: 'بعد میں کالم شامل کریں',
    deleteRow: 'قطار حذف کریں',
    deleteColumn: 'کالم حذف کریں',
    deleteTable: 'جدول حذف کریں',
    insertRowsBefore: 'پہلے قطاریں شامل کریں',
    insertRowsAfter: 'بعد میں قطاریں شامل کریں',
    insertColumnsBefore: 'پہلے کالمز شامل کریں',
    insertColumnsAfter: 'بعد میں کالمز شامل کریں',
    deleteRows: 'قطاریں حذف کریں',
    deleteColumns: 'کالمز حذف کریں',
    mergeCells: 'خانے ضم کریں',
    unmergeCell: 'خانہ الگ کریں',
  },
  poetryMenu: {
    menuLabel: 'شاعری',
    singleColumn: 'ایک کالم',
    twoColumn: 'دو کالم',
    staggered: 'کالم متبادل',
    narrowerCouplets: 'شعر کی چوڑائی کم',
    widerCouplets: 'شعر کی چوڑائی زیادہ',
    insertCoupletBefore: 'اوپر شعر شامل کریں',
    insertCoupletAfter: 'نیچے شعر شامل کریں',
    centerCouplet: 'یہ شعر وسط میں رکھیں',
    uncenterCouplet: 'وسط میں رکھنا ختم کریں',
    tighterSpacing: 'شعروں کے درمیان کم جگہ',
    looserSpacing: 'شعروں کے درمیان زیادہ جگہ',
    narrowerGutter: 'کالمز کے درمیان کم جگہ',
    widerGutter: 'کالمز کے درمیان زیادہ جگہ',
    deleteCouplet: 'شعر حذف کریں',
    deletePoetry: 'پوری شاعری حذف کریں',
  },
  findReplace: {
    toggle: 'تلاش اور تبدیلی',
    find: 'تلاش کریں',
    replace: 'تبدیل کریں',
    findPlaceholder: 'جو متن تلاش کرنا ہے',
    replacePlaceholder: 'تبدیل کرنے کا متن',
    previous: 'پچھلا',
    next: 'اگلا',
    replaceOne: 'تبدیل کریں',
    replaceAll: 'سب تبدیل کریں',
    noMatches: 'کوئی میچ نہیں',
    close: 'بند کریں',
  },
  spellcheck: {
    title: 'ہجے کی جانچ',
    language: 'زبان',
    check: 'جانچیں',
    close: 'بند کریں',
    noMisspellings: 'کوئی غلط ہجے نہیں ملے',
    previous: 'پچھلا',
    next: 'اگلا',
    noSuggestions: 'کوئی تجویز نہیں',
  },
  autoCorrect: {
    title: 'خودکار تصحیح',
    language: 'زبان',
    from: 'لکھا ہوا لفظ',
    fromPlaceholder: 'جو لفظ لکھا جاتا ہے',
    to: 'درست لفظ',
    toPlaceholder: 'اسے درست کریں',
    save: 'تصحیح محفوظ کریں',
    saved: 'محفوظ ہو گئی۔ اگلے لفظ پر لاگو ہوگی۔',
    noWritableStore: 'کوئی ذخیرہ نئی تصحیح قبول نہیں کرتا',
    failed: 'تصحیح محفوظ نہیں ہو سکی',
    close: 'بند کریں',
    correctDocument: 'تمام متن کی تصحیح کریں',
  },
  contextMenu: {
    cut: 'کاٹیں',
    copy: 'کاپی کریں',
    paste: 'چسپاں کریں',
    selectAll: 'سب منتخب کریں',
    ignore: 'نظرانداز کریں',
    addToDictionary: 'لغت میں شامل کریں',
    addToAutoCorrect: 'خودکار تصحیح میں شامل کریں',
    spelling: 'ہجے کی تجاویز',
    noSuggestions: 'کوئی تجویز نہیں',
  },
  autoComplete: {
    label: 'تجاویز',
  },
  link: {
    menuLabel: 'لنک',
    noUrl: '(کوئی یو آر ایل نہیں)',
    editLink: 'لنک میں ترمیم کریں',
    removeLink: 'لنک ہٹائیں',
  },
  linkDialog: {
    titleInsert: 'لنک شامل کریں',
    titleEdit: 'لنک میں ترمیم کریں',
    urlLabel: 'یو آر ایل',
    urlPlaceholder: 'https://example.com',
    textLabel: 'عبارت',
    textPlaceholder: 'لنک کی عبارت (نہ دینے پر یو آر ایل ہی استعمال ہوگا)',
    invalidUrl: 'براہِ کرم ایک درست http(s)، mailto، tel یا رشتہ دار یو آر ایل درج کریں',
    apply: 'لاگو کریں',
  },
  tableDialog: {
    title: 'جدول شامل کریں',
    rows: 'قطاریں',
    columns: 'کالم',
    headerRow: 'سرِ فہرست قطار',
  },
  layoutDialog: {
    title: 'کالم شامل کریں',
    columnCount: 'کالموں کی تعداد',
  },
  imageDialog: {
    titleInsert: 'تصویر شامل کریں',
    titleEdit: 'تصویر میں ترمیم کریں',
    currentImage: 'موجودہ تصویر',
    fromUrl: 'یو آر ایل سے',
    upload: 'اپ لوڈ',
    embeddedInDocument: 'دستاویز میں شامل',
    linkedFrom: (src) => `${src} سے منسلک`,
    convertButton: 'شامل شدہ تصویر میں تبدیل کریں',
    convertHint: 'دستاویز میں ایک نقل ڈاؤن لوڈ کرتا ہے، تاکہ اسے کاٹا، گھمایا اور سائز تبدیل کیا جا سکے۔',
    imageUrlLabel: 'تصویر کا یو آر ایل',
    imageUrlPlaceholder: 'https://example.com/photo.jpg',
    embedCopyLabel: 'دستاویز میں ایک نقل شامل کریں',
    embedCopyDescription: 'تصویر ڈاؤن لوڈ کرتا ہے تاکہ اس میں ترمیم کی جا سکے اور یہ یو آر ایل پر منحصر نہ رہے۔',
    convertedFromUrl: 'یو آر ایل سے تبدیل شدہ: ایک نقل دستاویز میں شامل کی جائے گی۔',
    fileLabel: 'تصویر کی فائل',
    filePlaceholder: 'ایک تصویر منتخب کریں',
    fileDescription: (maxSizeMB, storedInDocument) => `${maxSizeMB} ایم بی تک${storedInDocument ? '؛ دستاویز کے اندر محفوظ ہوتی ہے' : ''}`,
    altTextLabel: 'متبادل متن',
    altTextDescription: 'سکرین ریڈرز کے لیے تصویر کی تفصیل بیان کرتا ہے',
    captionLabel: 'کیپشن',
    captionDescription: 'تصویر کے نیچے دکھایا جاتا ہے۔ نہ چاہیں تو خالی چھوڑ دیں۔',
    errors: {
      enterUrl: 'ایک http(s) یا رشتہ دار تصویر یو آر ایل درج کریں',
      chooseFile: 'ایک تصویر فائل منتخب کریں',
      noImage: 'کوئی تصویر نہیں',
      uploadUnusable: 'اپ لوڈ ہینڈلر نے ناقابلِ استعمال یو آر ایل واپس کیا',
      couldNotSave: 'تصویر محفوظ نہیں ہو سکی',
      couldNotConvert: 'تصویر تبدیل نہیں ہو سکی',
      couldNotReadFile: 'فائل پڑھی نہیں جا سکی',
      largerThan: (maxSizeMB) => `تصویر ${maxSizeMB} ایم بی سے بڑی ہے`,
    },
  },
  imageCropDialog: {
    title: 'کاٹیں اور سائز تبدیل کریں',
    sizeLabel: 'سائز',
    widthLabel: 'چوڑائی (px)',
    heightLabel: 'اونچائی (px)',
    autoPlaceholder: 'خودکار',
    keepProportions: 'تناسب برقرار رکھیں',
    originalSize: 'اصل سائز',
    dragHint: (natural) =>
      `منتخب شدہ تصویر پر کارنر ہینڈل کھینچ کر بھی سائز تبدیل کیا جا سکتا ہے۔ ${natural ? `اصل: ${natural.width} × ${natural.height} پکسل۔` : ''}`,
    errors: {
      uploadUnusable: 'اپ لوڈ ہینڈلر نے ناقابلِ استعمال یو آر ایل واپس کیا',
      couldNotSave: 'تصویر محفوظ نہیں ہو سکی',
      largerThan: (maxSizeMB) => `تصویر ${maxSizeMB} ایم بی سے بڑی ہے`,
    },
  },
  imageMenu: {
    editImage: 'تصویر میں ترمیم کریں…',
    convertToEmbedded: 'شامل شدہ تصویر میں تبدیل کریں',
    cropResize: 'کاٹیں اور سائز تبدیل کریں…',
    addCaption: 'کیپشن شامل کریں…',
    editCaption: 'کیپشن میں ترمیم کریں…',
    removeCaption: 'کیپشن ہٹائیں',
    deleteImage: 'تصویر حذف کریں',
    resizeImage: 'تصویر کا سائز تبدیل کریں',
  },
};

const paShahmukhi: Strings = {
  editor: {
    placeholder: 'لکھنا شروع کرو…',
    contentLabel: 'ایڈیٹر دی سامگری',
    pageBreakLabel: 'صفحے دی ونڈ',
  },
  common: {
    cancel: 'رد کرو',
    save: 'سنبھالو',
    insert: 'پاؤ',
  },
  toolbar: {
    ariaLabel: 'فارمیٹنگ',
    save: 'سنبھالو',
    drafts: 'سودھے',
    undo: 'پہلاں جیہا کرو',
    redo: 'مُڑ کرو',
    formattingLabel: 'فارمیٹنگ',
    bold: 'گہرا',
    italic: 'ترچھا',
    underline: 'تھلے لکیر',
    fontFamily: 'فونٹ خاندان',
    fontFamilyPlaceholder: 'فونٹ',
    fontSize: 'فونٹ دا سائز',
    fontSizePlaceholder: 'سائز',
    noMatch: 'کوئی نئیں ملیا',
    alignment: 'سیدھ',
    linkOptions: 'لنک دے اختیار',
    tableOptions: 'ٹیبل دے اختیار',
    poetryOptions: 'شاعری دے اختیار',
    insertLink: 'لنک پاؤ (Ctrl+K)',
    insertImage: 'تصویر پاؤ',
    insertPageBreak: 'صفحے دی ونڈ پاؤ',
    insertTable: 'ٹیبل پاؤ',
    insertColumns: 'کالم پاؤ',
    insertFootnote: 'فٹ نوٹ پاؤ',
    insertPoetryCouplet: 'شعر پاؤ',
    insertHorizontalRule: 'لیٹی لکیر پاؤ',
    comingSoon: (label) => `${label} (چھیتی آ رہا اے)`,
    autocorrect: 'خودکار درستی',
    textCleanup: 'متن دی صفائی',
    spellChecker: 'ہجے چیکر',
    moreFormatting: 'ہور فارمیٹنگ',
    strikethrough: 'کٹی لکیر',
    superscript: 'اُتلا لکھت',
    subscript: 'تلا لکھت',
    uppercase: 'وڈے حرف',
    lowercase: 'نکے حرف',
    capitalize: 'پہلا حرف وڈا',
    clearFormatting: 'فارمیٹنگ ہٹاؤ',
    outdent: 'حاشیہ گھٹاؤ',
    indent: 'حاشیہ ودھاؤ',
    formattingOptions: {
      paragraph: 'پیراگراف',
      heading: (level) => `سرلیکھ ${level}`,
      numberedList: 'نمبردار لسٹ',
      bulletList: 'بلٹ لسٹ',
      taskList: 'ٹاسک لسٹ',
      quote: 'حوالہ',
    },
    alignOptions: {
      start: 'شروع دی سیدھ',
      center: 'وچکار دی سیدھ',
      end: 'آخری سیدھ',
      justify: 'دوویں پاسے سیدھ',
      left: 'بائیں سیدھ',
      right: 'سجے سیدھ',
    },
  },
  leaveDialog: {
    title: 'غیر محفوظ تبدیلیاں',
    message: 'تہاڈیاں تبدیلیاں سنبھالیاں نئیں گئیاں۔ جان توں پہلاں تسی کی کرنا چاہو گے؟',
    save: 'سنبھالو',
    saveDraft: 'سودھا سنبھالو',
    discard: 'رد کرو',
    saveDraftFailed: 'سودھا سنبھالیا نئیں جا سکیا (دستاویز بہت وڈی ہو سکدی اے، یا براؤزر دی سٹوریج نئیں اے)۔',
  },
  drafts: {
    bannerMessage: (when) => `ایس دستاویز دا اک غیر محفوظ سودھا (${when}) لبھیا اے۔`,
    restore: 'بحال کرو',
    ignore: 'نظر انداز کرو',
    remove: 'سودھا ہٹاؤ',
    dialogTitle: 'سنبھالے ہوئے سودھے',
    intro: 'لکھدیاں ہویاں سودھے ایس براؤزر وچ آپ سنبھلدے نیں تے سنبھالن تے ہٹ جاندے نیں۔',
    empty: 'ہلے کوئی سودھا نئیں۔',
    noText: '(کوئی متن نئیں)',
    thisDocument: 'موجودہ دستاویز',
    untitled: 'بنا ناں دا سودھا',
    documentLabel: (id) => `دستاویز «${id}»`,
    earlierUntitled: 'اک بنا ناں دے سودھے دا پرانا ورژن',
    earlierVersionOf: (id) => `«${id}» دا پرانا ورژن`,
    savedAt: (when) => `سنبھالیا: ${when}`,
    size: (kb) => `${kb} کے بی`,
    replacePrompt: 'موجودہ مواد نوں ایس سودھے نال بدل دیئے؟',
    replace: 'بدل دیو',
    deletePrompt: 'ایہ سودھا مٹا دیئے؟',
    delete: 'مٹاؤ',
    close: 'بند کرو',
  },
  tableMenu: {
    menuLabel: 'ٹیبل',
    insertRowBefore: 'پہلاں قطار پاؤ',
    insertRowAfter: 'بعد وچ قطار پاؤ',
    insertColumnBefore: 'پہلاں کالم پاؤ',
    insertColumnAfter: 'بعد وچ کالم پاؤ',
    deleteRow: 'قطار مٹاؤ',
    deleteColumn: 'کالم مٹاؤ',
    deleteTable: 'ٹیبل مٹاؤ',
    insertRowsBefore: 'پہلاں قطاراں پاؤ',
    insertRowsAfter: 'بعد وچ قطاراں پاؤ',
    insertColumnsBefore: 'پہلاں کالماں پاؤ',
    insertColumnsAfter: 'بعد وچ کالماں پاؤ',
    deleteRows: 'قطاراں مٹاؤ',
    deleteColumns: 'کالماں مٹاؤ',
    mergeCells: 'خانے رلاؤ',
    unmergeCell: 'خانہ الگ کرو',
  },
  poetryMenu: {
    menuLabel: 'شاعری',
    singleColumn: 'اک کالم',
    twoColumn: 'دو کالم',
    staggered: 'وارو وار پاسے',
    narrowerCouplets: 'شعر دی چوڑائی گھٹ',
    widerCouplets: 'شعر دی چوڑائی ودھ',
    insertCoupletBefore: 'اُتے شعر شامل کرو',
    insertCoupletAfter: 'ھیٹھ شعر شامل کرو',
    centerCouplet: 'ایہ شعر وچکار رکھو',
    uncenterCouplet: 'وچکار رکھنا بند کرو',
    tighterSpacing: 'شعراں وچکار گھٹ جگہ',
    looserSpacing: 'شعراں وچکار ودھ جگہ',
    narrowerGutter: 'کالماں وچکار گھٹ جگہ',
    widerGutter: 'کالماں وچکار ودھ جگہ',
    deleteCouplet: 'شعر مٹاؤ',
    deletePoetry: 'ساری شاعری مٹاؤ',
  },
  findReplace: {
    toggle: 'لبھو تے بدلو',
    find: 'لبھو',
    replace: 'بدلو',
    findPlaceholder: 'جو لبھنا اے',
    replacePlaceholder: 'بدلن والا متن',
    previous: 'پچھلا',
    next: 'اگلا',
    replaceOne: 'بدلو',
    replaceAll: 'سارے بدلو',
    noMatches: 'کوئی ملدا نئیں',
    close: 'بند کرو',
  },
  spellcheck: {
    title: 'ہجے دی جانچ',
    language: 'بولی',
    check: 'جانچو',
    close: 'بند کرو',
    noMisspellings: 'کوئی غلط ہجے نئیں لبھے',
    previous: 'پچھلا',
    next: 'اگلا',
    noSuggestions: 'کوئی تجویز نئیں',
  },
  autoCorrect: {
    title: 'خودکار درستی',
    language: 'بولی',
    from: 'لکھیا ہویا لفظ',
    fromPlaceholder: 'جو لفظ لکھیا جاندا اے',
    to: 'ٹھیک لفظ',
    toPlaceholder: 'ایس نوں ٹھیک کرو',
    save: 'درستی سانبھو',
    saved: 'سانبھ لیا۔ اگلے لفظ تے لاگو ہووے گی۔',
    noWritableStore: 'کوئی ذخیرہ نویں درستی نئیں منّدا',
    failed: 'درستی سانبھی نئیں جا سکی',
    close: 'بند کرو',
    correctDocument: 'پورے متن دی درستی کرو',
  },
  contextMenu: {
    cut: 'کٹو',
    copy: 'کاپی کرو',
    paste: 'چسپاں کرو',
    selectAll: 'سارا چنو',
    ignore: 'نظر انداز کرو',
    addToDictionary: 'شبدکوش وچ پاؤ',
    addToAutoCorrect: 'خودکار درستی وچ پاؤ',
    spelling: 'ہجے دیاں تجویزاں',
    noSuggestions: 'کوئی تجویز نئیں',
  },
  autoComplete: {
    label: 'تجویزاں',
  },
  link: {
    menuLabel: 'لنک',
    noUrl: '(کوئی یو آر ایل نئیں)',
    editLink: 'لنک وچ تبدیلی کرو',
    removeLink: 'لنک ہٹاؤ',
  },
  linkDialog: {
    titleInsert: 'لنک پاؤ',
    titleEdit: 'لنک وچ تبدیلی کرو',
    urlLabel: 'یو آر ایل',
    urlPlaceholder: 'https://example.com',
    textLabel: 'لکھت',
    textPlaceholder: 'لنک دی لکھت (نہ دین تے یو آر ایل ای ورتیا جاوے گا)',
    invalidUrl: 'کِرپا کر کے صحیح http(s)، mailto، tel یا نسبتی یو آر ایل پاؤ',
    apply: 'لاگو کرو',
  },
  tableDialog: {
    title: 'ٹیبل پاؤ',
    rows: 'قطاراں',
    columns: 'کالم',
    headerRow: 'سرکڑی قطار',
  },
  layoutDialog: {
    title: 'کالم پاؤ',
    columnCount: 'کالماں دی گنتی',
  },
  imageDialog: {
    titleInsert: 'تصویر پاؤ',
    titleEdit: 'تصویر وچ تبدیلی کرو',
    currentImage: 'موجودہ تصویر',
    fromUrl: 'یو آر ایل توں',
    upload: 'اپ لوڈ',
    embeddedInDocument: 'دستاویز وچ شامل',
    linkedFrom: (src) => `${src} توں لنک کیتا گیا`,
    convertButton: 'شامل تصویر وچ بدلو',
    convertHint: 'دستاویز وچ اک کاپی ڈاؤن لوڈ کردا اے، تاں جو ایہنوں کٹیا، گھمایا تے سائز بدلیا جا سکے۔',
    imageUrlLabel: 'تصویر دا یو آر ایل',
    imageUrlPlaceholder: 'https://example.com/photo.jpg',
    embedCopyLabel: 'دستاویز وچ اک کاپی شامل کرو',
    embedCopyDescription: 'تصویر ڈاؤن لوڈ کردا اے تاں جو ایہنوں تبدیل کیتا جا سکے تے ایہہ یو آر ایل تے منحصر نہ رہے۔',
    convertedFromUrl: 'یو آر ایل توں بدلیا گیا: اک کاپی دستاویز وچ شامل کیتی جاوے گی۔',
    fileLabel: 'تصویر دی فائل',
    filePlaceholder: 'اک تصویر چُنو',
    fileDescription: (maxSizeMB, storedInDocument) => `${maxSizeMB} ایم بی تیک${storedInDocument ? '؛ دستاویز دے اندر سنبھالی جاندی اے' : ''}`,
    altTextLabel: 'بدل متن',
    altTextDescription: 'سکرین ریڈرز لئی تصویر دی وضاحت کردا اے',
    captionLabel: 'کیپشن',
    captionDescription: 'تصویر دے تھلے دکھایا جاندا اے۔ نہ چاہیدا تے خالی چھڈ دیو۔',
    errors: {
      enterUrl: 'اک http(s) یا نسبتی تصویر یو آر ایل پاؤ',
      chooseFile: 'اک تصویر فائل چُنو',
      noImage: 'کوئی تصویر نئیں',
      uploadUnusable: 'اپ لوڈ ہینڈلر نے ناکارآمد یو آر ایل موڑیا',
      couldNotSave: 'تصویر سنبھالی نئیں جا سکی',
      couldNotConvert: 'تصویر بدلی نئیں جا سکی',
      couldNotReadFile: 'فائل پڑھی نئیں جا سکی',
      largerThan: (maxSizeMB) => `تصویر ${maxSizeMB} ایم بی توں وڈی اے`,
    },
  },
  imageCropDialog: {
    title: 'کٹو تے سائز بدلو',
    sizeLabel: 'سائز',
    widthLabel: 'چوڑائی (px)',
    heightLabel: 'اُچائی (px)',
    autoPlaceholder: 'خودکار',
    keepProportions: 'تناسب رکھو',
    originalSize: 'اصلی سائز',
    dragHint: (natural) =>
      `چُنی ہوئی تصویر تے کارنر ہینڈل گھسیٹ کے وی سائز بدلیا جا سکدا اے۔ ${natural ? `اصلی: ${natural.width} × ${natural.height} پکسل۔` : ''}`,
    errors: {
      uploadUnusable: 'اپ لوڈ ہینڈلر نے ناکارآمد یو آر ایل موڑیا',
      couldNotSave: 'تصویر سنبھالی نئیں جا سکی',
      largerThan: (maxSizeMB) => `تصویر ${maxSizeMB} ایم بی توں وڈی اے`,
    },
  },
  imageMenu: {
    editImage: 'تصویر وچ تبدیلی کرو…',
    convertToEmbedded: 'شامل تصویر وچ بدلو',
    cropResize: 'کٹو تے سائز بدلو…',
    addCaption: 'کیپشن شامل کرو…',
    editCaption: 'کیپشن وچ تبدیلی کرو…',
    removeCaption: 'کیپشن ہٹاؤ',
    deleteImage: 'تصویر مٹاؤ',
    resizeImage: 'تصویر دا سائز بدلو',
  },
};

export const STRINGS: Record<Locale, Strings> = {
  en,
  ur,
  'pa-shahmukhi': paShahmukhi,
};

/** Returns the strings dictionary for `locale`, defensively falling back to
 * `en` for any locale not present in `STRINGS` (e.g. a future locale value
 * passed by a caller on an older type definition). */
export function getStrings(locale: Locale): Strings {
  return STRINGS[locale] ?? STRINGS.en;
}
