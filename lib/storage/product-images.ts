import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_IMAGES_PER_PRODUCT,
  MAX_INPUT_PIXELS,
  OPTIMIZED_MAX_DIMENSION,
  OPTIMIZED_WEBP_QUALITY,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/storage/constants";
import {
  altTextSchema,
  productIdSchema,
  reorderImagesSchema,
  sanitizeFileName,
  validateImageFile,
} from "@/lib/storage/validation";

/*
 * Privileged, server-only operations (service role, bypasses RLS).
 * These functions do NOT authorize the caller: the Server Action / Route Handler
 * that uses them must first verify the user is an administrator.
 */

export type UploadResult = {
  uploaded: { id: string; storagePath: string }[];
  errors: { fileName: string; message: string }[];
};

const DETECTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Verifies real image content (not just the claimed MIME) and optimizes to WebP. */
async function optimizeImage(input: Buffer) {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
  const meta = await image.metadata();
  if (!meta.format || !DETECTED_FORMATS.has(meta.format)) {
    throw new Error("File content is not a valid JPG, PNG or WebP image");
  }
  // rotate() applies EXIF orientation; output drops metadata (incl. GPS).
  return image
    .rotate()
    .resize({
      width: OPTIMIZED_MAX_DIMENSION,
      height: OPTIMIZED_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: OPTIMIZED_WEBP_QUALITY, effort: 4 })
    .toBuffer();
}

export async function uploadProductImages(
  productId: string,
  files: File[],
  altText?: string,
): Promise<UploadResult> {
  const id = productIdSchema.parse(productId);
  const alt = altTextSchema.parse(altText) ?? null;
  const supabase = createAdminClient();
  const result: UploadResult = { uploaded: [], errors: [] };

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!product) throw new Error("Product not found");

  const { data: existing, error: existingError } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", id)
    .order("sort_order", { ascending: false });
  if (existingError) throw new Error(existingError.message);

  if ((existing?.length ?? 0) + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new Error(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
  }

  let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  for (const file of files) {
    const check = validateImageFile(file);
    if (!check.ok) {
      result.errors.push({ fileName: file.name, message: check.message });
      continue;
    }

    let path: string | null = null;
    try {
      const optimized = await optimizeImage(Buffer.from(await file.arrayBuffer()));
      path = `${id}/${sanitizeFileName(file.name)}-${randomUUID().slice(0, 8)}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, optimized, {
          contentType: "image/webp",
          cacheControl: "31536000", // path is unique per upload, so it is immutable
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { data: row, error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: id,
          storage_path: path,
          alt_text: alt,
          sort_order: nextOrder,
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);

      nextOrder += 1;
      result.uploaded.push({ id: row.id, storagePath: path });
    } catch (error) {
      if (path) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
      result.errors.push({
        fileName: file.name,
        message: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  return result;
}

/** Sets display order; imageIds must be exactly the product's images, first = primary. */
export async function reorderProductImages(productId: string, imageIds: string[]) {
  const input = reorderImagesSchema.parse({ productId, imageIds });
  const { error } = await createAdminClient().rpc("reorder_product_images", {
    p_product_id: input.productId,
    p_image_ids: input.imageIds,
  });
  if (error) throw new Error(`Failed to reorder images: ${error.message}`);
}

export async function deleteProductImage(imageId: string) {
  const supabase = createAdminClient();
  const { data: image, error } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .eq("id", productIdSchema.parse(imageId))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!image) return;

  const { error: removeError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([image.storage_path]);
  if (removeError) throw new Error(removeError.message);

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("id", image.id);
  if (deleteError) throw new Error(deleteError.message);
}

/** Call before deleting a product: DB rows cascade, storage objects do not. */
export async function deleteAllProductImages(productId: string) {
  const supabase = createAdminClient();
  const id = productIdSchema.parse(productId);

  const { data: images, error } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", id);
  if (error) throw new Error(error.message);

  if (images.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove(images.map((i) => i.storage_path));
    if (removeError) throw new Error(removeError.message);
  }

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", id);
  if (deleteError) throw new Error(deleteError.message);
}
