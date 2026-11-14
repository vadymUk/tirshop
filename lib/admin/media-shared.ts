import { z } from "zod";
import { publicEnv } from "@/lib/env";

export const mediaBucket = z.enum(["product-images", "site-media"]);
export type MediaBucket = z.infer<typeof mediaBucket>;
export const mediaPath = z.string().min(1).max(500).regex(/^[a-zA-Z0-9_./-]+$/).refine((path) => !path.split("/").includes(".."));
export const seoImagePath = mediaPath.refine((path) => !path.startsWith("/"), "Вкажіть шлях у медіатеці, а не URL");

export function mediaUrl(bucket: MediaBucket, path: string, thumbnail = false) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const transform = thumbnail && publicEnv.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS === "true";
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/${transform ? "render/image" : "object"}/public/${bucket}/${encoded}${transform ? "?width=240&height=240&resize=contain&quality=75" : ""}`;
}

export function mediaFilters(raw: Record<string, string | string[] | undefined>) {
  const value = (key: string) => typeof raw[key] === "string" ? raw[key] as string : "";
  const bucket = mediaBucket.safeParse(value("bucket"));
  const type = z.enum(["image/jpeg", "image/png", "image/webp"]).safeParse(value("type"));
  const product = z.string().uuid().safeParse(value("product"));
  const page = /^\d{1,5}$/.test(value("page")) ? Math.max(1, Number(value("page"))) : 1;
  return { bucket: bucket.success ? bucket.data : "site-media" as const, type: type.success ? type.data : "",
    query: value("q").trim().slice(0, 100), ascending: value("sort") === "asc",
    orphan: value("orphan") === "1", product: product.success ? product.data : "", page };
}
