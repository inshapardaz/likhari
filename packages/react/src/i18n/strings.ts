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
    /** window.confirm() prompt shown by EditorRef.confirmDiscard() when there are unsaved changes. */
    confirmDiscard: string;
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
    insertLink: string;
    insertImage: string;
    poetryBlocks: string;
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
    confirmDiscard: 'You have unsaved changes. Discard them?',
  },
  common: {
    cancel: 'Cancel',
    save: 'Save',
    insert: 'Insert',
  },
  toolbar: {
    ariaLabel: 'Formatting',
    save: 'Save',
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
    insertLink: 'Insert link (Ctrl+K)',
    insertImage: 'Insert image',
    poetryBlocks: 'Poetry blocks',
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
    confirmDiscard: 'آپ کی غیر محفوظ شدہ تبدیلیاں ہیں۔ کیا انہیں رد کر دیا جائے؟',
  },
  common: {
    cancel: 'منسوخ کریں',
    save: 'محفوظ کریں',
    insert: 'شامل کریں',
  },
  toolbar: {
    ariaLabel: 'فارمیٹنگ',
    save: 'محفوظ کریں',
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
    insertLink: 'لنک شامل کریں (Ctrl+K)',
    insertImage: 'تصویر شامل کریں',
    poetryBlocks: 'شاعری کے بلاکس',
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
    confirmDiscard: 'تہاڈیاں کجھ تبدیلیاں سنبھالیاں نئیں گئیاں۔ کی ایہناں نوں رد کر دیئے؟',
  },
  common: {
    cancel: 'رد کرو',
    save: 'سنبھالو',
    insert: 'پاؤ',
  },
  toolbar: {
    ariaLabel: 'فارمیٹنگ',
    save: 'سنبھالو',
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
    insertLink: 'لنک پاؤ (Ctrl+K)',
    insertImage: 'تصویر پاؤ',
    poetryBlocks: 'شاعری بلاک',
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
