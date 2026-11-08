export const PRODUCT_IMAGES_BUCKET = "product-images";

/** MIME type -> allowed extensions. */
export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

/** Maximum size of an uploaded original (before server-side optimization). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 10;

/** Optimization applied on upload: longest side cap and WebP quality. */
export const OPTIMIZED_MAX_DIMENSION = 2000;
export const OPTIMIZED_WEBP_QUALITY = 82;
export const MAX_INPUT_PIXELS = 50_000_000;

/** Named sizes for product imagery (width in px). */
export const IMAGE_PRESETS = {
  thumbnail: { width: 160, height: 160, resize: "cover" },
  card: { width: 480, height: 480, resize: "cover" },
  detail: { width: 960, resize: "contain" },
  zoom: { width: 1600, resize: "contain" },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;
