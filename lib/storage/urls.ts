import { publicEnv } from "@/lib/env";
import {
  IMAGE_PRESETS,
  PRODUCT_IMAGES_BUCKET,
  type ImagePreset,
} from "@/lib/storage/constants";

type UrlOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

/** Supabase image transformations are a paid feature; opt in via env. */
export const transformsEnabled =
  publicEnv.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS === "true";

/** Original public object URL (no transformation). */
export function getProductImageOriginalUrl(storagePath: string) {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encodePath(storagePath)}`;
}

/** Public URL; transformed (resized/compressed) when transformations are enabled. */
export function getProductImageUrl(storagePath: string, opts: UrlOptions = {}) {
  if (!transformsEnabled || !opts.width) {
    return getProductImageOriginalUrl(storagePath);
  }
  const params = new URLSearchParams({
    width: String(Math.min(Math.round(opts.width), 2500)),
    quality: String(Math.min(Math.max(opts.quality ?? 80, 20), 100)),
    resize: opts.resize ?? "contain",
  });
  if (opts.height) params.set("height", String(Math.round(opts.height)));
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/render/image/public/${PRODUCT_IMAGES_BUCKET}/${encodePath(storagePath)}?${params}`;
}

export function getProductImagePresetUrl(
  storagePath: string,
  preset: ImagePreset,
) {
  return getProductImageUrl(storagePath, IMAGE_PRESETS[preset]);
}

/** Orders images by sort_order (stable); does not mutate the input. */
export function sortProductImages<T extends { sort_order: number }>(
  images: readonly T[],
) {
  return [...images].sort((a, b) => a.sort_order - b.sort_order);
}

/** First image in display order, or null. */
export function getPrimaryImage<T extends { sort_order: number }>(
  images: readonly T[] | null | undefined,
) {
  return images?.length ? sortProductImages(images)[0] : null;
}

/** Loader for next/image when Supabase transformations are enabled. */
export function supabaseImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  return getProductImageUrl(src, { width, quality });
}
