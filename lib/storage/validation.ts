import { z } from "zod";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/storage/constants";

type FileLike = { name: string; type: string; size: number };

export type FileValidation =
  | { ok: true }
  | { ok: false; message: string };

/** Cheap checks usable in both browser (pre-upload UX) and server. */
export function validateImageFile(file: FileLike): FileValidation {
  if (file.size <= 0) return { ok: false, message: "File is empty" };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExts = ALLOWED_IMAGE_TYPES[
    file.type as keyof typeof ALLOWED_IMAGE_TYPES
  ] as readonly string[] | undefined;

  if (
    !(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ||
    !allowedExts ||
    !allowedExts.includes(ext)
  ) {
    return { ok: false, message: "Only JPG, PNG and WebP images are allowed" };
  }
  return { ok: true };
}

/** Lowercase ASCII slug without path parts or extension; safe for storage keys. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const withoutExt = base.replace(/\.[^.]*$/, "");
  const slug = withoutExt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "image";
}

export const productIdSchema = z.string().uuid();

export const reorderImagesSchema = z.object({
  productId: z.string().uuid(),
  imageIds: z.array(z.string().uuid()).min(1),
});

export const altTextSchema = z.string().trim().max(200).optional();
