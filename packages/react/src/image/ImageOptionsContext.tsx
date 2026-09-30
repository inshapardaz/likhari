import { createContext, useContext } from 'react';

/** Image settings from `EditorRoot` (feature config + upload handler), shared
 * with the toolbar's insert dialog and with each image's own edit menu/dialog. */
export interface ImageOptions {
  /** `images.linked` — images may reference an external URL. */
  allowLinked: boolean;
  /** `images.embedded` — images may be uploaded. */
  allowEmbedded: boolean;
  /** `images.caption` — images may have a caption. */
  allowCaption: boolean;
  /** `images.maxSizeMB` */
  maxSizeMB: number;
  /** Host upload handler; without it, uploads are embedded as base64 data URIs. */
  onImageUpload?: (file: File) => Promise<string>;
}

export const ImageOptionsContext = createContext<ImageOptions>({
  allowLinked: true,
  allowEmbedded: true,
  allowCaption: true,
  maxSizeMB: 5,
});

export function useImageOptions(): ImageOptions {
  return useContext(ImageOptionsContext);
}
