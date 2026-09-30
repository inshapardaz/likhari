/**
 * Loads the Urdu/Arabic-script font collection from the
 * inshapardaz/urdu-web-fonts GitHub repository through jsDelivr's GitHub
 * CDN — the same source, and the same pinned commit, that the qari EPUB
 * reader uses, so both apps offer an identical font set. Nothing is bundled
 * or added as an npm dependency.
 *
 * Pinned to a commit (not a branch) so the fonts served don't change under
 * consumers unexpectedly; bump URDU_WEB_FONTS_COMMIT to pick up upstream
 * additions. Each family's stylesheet only registers its @font-face rules —
 * the browser downloads a font file when that font is actually used.
 */
const URDU_WEB_FONTS_COMMIT = '571e360d5c272252efb0b0b21af54d1f63457521';
const URDU_WEB_FONTS_BASE_URL = `https://cdn.jsdelivr.net/gh/inshapardaz/urdu-web-fonts@${URDU_WEB_FONTS_COMMIT}/src/fonts`;

interface UrduWebFontEntry {
  /** Directory name of the font in the urdu-web-fonts repo */
  dir: string;
  /** Display name shown in the font dropdown */
  name: string;
  /** CSS font-family name declared in the font's stylesheet.css */
  family: string;
}

const URDU_WEB_FONTS: UrduWebFontEntry[] = [
  { dir: 'adobe-arabic', name: 'Adobe Arabic', family: 'AdobeArabic' },
  { dir: 'alvi-lahori-nastalique', name: 'Alvi Lahori Nastaleeq', family: 'AlviLahoriNastaleeq' },
  { dir: 'amiri', name: 'Amiri', family: 'Amiri' },
  { dir: 'aref-ruqqa', name: 'Aref Ruqaa', family: 'Aref Ruqaa' },
  { dir: 'dehalvi-khushkhat', name: 'Dehalvi Khush Khat', family: 'DehalviKhushKhat' },
  { dir: 'dubai', name: 'Dubai', family: 'Dubai' },
  { dir: 'emad-nastaleeq', name: 'Emad Nastaleeq', family: 'EmadNastaleeq' },
  { dir: 'fajer-noori-nastalique', name: 'Fajer Noori Nastalique', family: 'FajerNooriNastalique' },
  { dir: 'gulzar-nastalique', name: 'Gulzar Nastalique', family: 'gulzar-nastalique' },
  { dir: 'jameel-khushkhati', name: 'Jameel Khushkhati', family: 'jameel-khushkhati' },
  { dir: 'jameel-noori-kasheeda', name: 'Jameel Noori Nastaleeq Kasheeda', family: 'JameelNooriNastaleeqKasheeda' },
  { dir: 'jameel-noori-nastalique', name: 'Jameel Noori Nastaleeq', family: 'JameelNooriNastaleeq' },
  { dir: 'lalezar', name: 'Lalezar', family: 'Lalezar' },
  { dir: 'lateef', name: 'Lateef', family: 'Lateef' },
  { dir: 'mada', name: 'Mada', family: 'Mada' },
  { dir: 'mehr-nastalique', name: 'Mehr Nastaleeq', family: 'MehrNastaleeq' },
  { dir: 'mehr-nastalique-2', name: 'Mehr Nastaliq Web', family: 'Mehr Nastaliq Web' },
  { dir: 'nafees-nastaleeq', name: 'Nafees Nastaleeq', family: 'NafeesNastaleeq' },
  { dir: 'Nafees-web-naskh', name: 'Nafees Web Naskh', family: 'NafeesWebNaskh' },
  { dir: 'noto-naskh', name: 'Noto Naskh Arabic', family: 'Noto Naskh Arabic' },
  { dir: 'noto-nastalique', name: 'Noto Nastaliq Urdu', family: 'Noto Nastaliq Urdu' },
  { dir: 'pak-nastaleeq', name: 'Pak Nastaleeq', family: 'PakNastaleeq' },
  { dir: 'qahiri', name: 'Qahiri', family: 'Qahiri' },
  { dir: 'reem-kufi', name: 'Reem Kufi', family: 'Reem Kufi' },
  { dir: 'sameer-khashab-bold', name: 'Sameer Khashab Bold', family: 'sameer-khashab' },
  { dir: 'scheherazade', name: 'Scheherazade New', family: 'Scheherazade New' },
];

/** One entry in the toolbar's font-family dropdown. */
export interface FontOption {
  /** Label shown in the dropdown */
  name: string;
  /** CSS font-family value stored on the selected text, e.g. `"Amiri", serif` */
  family: string;
  /** Optional dropdown group heading */
  group?: string;
}

export const URDU_WEB_FONT_OPTIONS: FontOption[] = URDU_WEB_FONTS.map((font) => ({
  name: font.name,
  family: `"${font.family}", serif`,
  group: 'Urdu / Arabic script',
}));

let injected = false;

/** Registers every urdu-web-fonts @font-face via a <link> per family. Safe to
 * call repeatedly and from several editors: it injects once per page. */
export function injectUrduWebFontsCss(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.querySelector('link[data-likhari-urdu-fonts]')) {
    injected = true;
    return;
  }
  for (const font of URDU_WEB_FONTS) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${URDU_WEB_FONTS_BASE_URL}/${font.dir}/stylesheet.css`;
    link.setAttribute('data-likhari-urdu-fonts', font.dir);
    document.head.appendChild(link);
  }
  injected = true;
}
