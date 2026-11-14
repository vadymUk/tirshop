"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { authorizeAdminOperation, logAdminActivity } from "@/lib/admin/security";
import { mediaBucket, mediaPath } from "@/lib/admin/media-shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_INPUT_PIXELS, MAX_UPLOAD_BYTES, OPTIMIZED_MAX_DIMENSION, OPTIMIZED_WEBP_QUALITY } from "@/lib/storage/constants";
import { sanitizeFileName, validateImageFile } from "@/lib/storage/validation";

const requestSchema = z.object({ bucket: mediaBucket, path: mediaPath });

async function optimize(input: Buffer, expectedType?: string) {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  const meta = await image.metadata();
  const expected = meta.format === "jpeg" ? "image/jpeg" : meta.format === "png" ? "image/png" : meta.format === "webp" ? "image/webp" : null;
  if (!expected || (expectedType && expected !== expectedType) || (meta.pages ?? 1) > 1) throw new Error("Підтримуються лише коректні JPG, PNG та WebP без анімації.");
  const output = await image.rotate().resize({ width: OPTIMIZED_MAX_DIMENSION, height: OPTIMIZED_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: OPTIMIZED_WEBP_QUALITY, effort: 4 }).toBuffer({ resolveWithObject: true });
  if (output.data.length > 5 * 1024 * 1024) throw new Error("Оптимізоване зображення перевищує 5 МБ.");
  return output;
}

async function saveImage(bucket: z.infer<typeof mediaBucket>, folder: string, fileName: string, input: Buffer, mime?: string) {
  const image = await optimize(input, mime);
  const path = `${folder}/${sanitizeFileName(fileName)}-${randomUUID()}.webp`;
  const admin = createAdminClient();
  const uploaded = await admin.storage.from(bucket).upload(path, image.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (uploaded.error) throw new Error(`Помилка сховища: ${uploaded.error.message}`);
  const record = await admin.from("media_metadata").insert({ bucket, path, original_name: fileName.slice(0, 200), width: image.info.width, height: image.info.height });
  if (record.error) throw new Error(`Файл завантажено, але метадані не збережено (${path}): ${record.error.message}. Потрібна ручна перевірка.`);
  return path;
}

export async function uploadMedia(form: FormData) {
  await authorizeAdminOperation("media-upload", 30, 60);
  const bucket = mediaBucket.parse(form.get("bucket"));
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Виберіть файл.");
  const valid = validateImageFile(file);
  if (!valid.ok) throw new Error(valid.message);
  const path = await saveImage(bucket, `library/${randomUUID()}`, file.name, Buffer.from(await file.arrayBuffer()), file.type);
  await logAdminActivity({ action: "upload", entityType: "media", metadata: { bucket } });
  revalidatePath("/admin/media");
  return { path };
}

export async function deleteMedia(input: unknown) {
  await authorizeAdminOperation("media-delete", 30, 60);
  const { bucket, path } = requestSchema.parse(input);
  const db = await createClient();
  const claimed = await db.rpc("admin_claim_media_deletion", { p_bucket: bucket, p_path: path });
  if (claimed.error) {
    if (claimed.error.message.includes("media_is_referenced")) throw new Error("Файл використовується і не може бути видалений.");
    if (claimed.error.message.includes("legacy_media_requires_manual_review")) throw new Error("Для старого файлу потрібна ручна перевірка посилань.");
    throw new Error(`Не вдалося перевірити посилання: ${claimed.error.message}`);
  }
  if (!claimed.data) throw new Error("Перевірка видалення не підтвердила доступ до файлу.");
  const removed = await createAdminClient().storage.from(bucket).remove([path]);
  if (removed.error) throw new Error(`Видалення не завершено. Файл заблоковано для нових прив’язок; повторіть операцію: ${removed.error.message}`);
  await logAdminActivity({ action: "delete", entityType: "media", metadata: { bucket } });
  revalidatePath("/admin/media");
}

export async function attachMedia(input: unknown) {
  await authorizeAdminOperation("media-attach", 30, 60);
  const { bucket, path, product } = requestSchema.extend({ product: z.string().uuid() }).parse(input);
  const download = await createAdminClient().storage.from(bucket).download(path);
  if (download.error || !download.data) throw new Error(`Не вдалося завантажити джерело: ${download.error?.message ?? "файл відсутній"}`);
  if (download.data.size > MAX_UPLOAD_BYTES) throw new Error("Джерело перевищує допустимий розмір.");
  const newPath = await saveImage("product-images", product, path.split("/").pop() ?? "image", Buffer.from(await download.data.arrayBuffer()));
  const result = await (await createClient()).rpc("admin_attach_product_image", { p_product: product, p_path: newPath });
  if (result.error) throw new Error(`Не вдалося прив’язати зображення (${newPath}): ${result.error.message}. Копія залишилась у медіатеці.`);
  updateTag("products");
  revalidatePath(`/admin/products/${product}/edit`);
  revalidatePath("/admin/media");
  await logAdminActivity({ action: "attach", entityType: "product_image", entityId: product });
}

export async function detachMedia(input: unknown) {
  await authorizeAdminOperation("media-detach", 30, 60);
  const { id, product } = z.object({ id: z.string().uuid(), product: z.string().uuid() }).parse(input);
  const result = await (await createClient()).from("product_images").delete().eq("id", id).eq("product_id", product).select("id");
  if (result.error) throw new Error(`Не вдалося відв’язати зображення: ${result.error.message}`);
  if (!result.data.length) throw new Error("Зображення вже відв’язане або не знайдене.");
  updateTag("products");
  revalidatePath(`/admin/products/${product}/edit`);
  revalidatePath("/admin/media");
}
