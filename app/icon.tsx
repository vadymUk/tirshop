import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getPublicSettings } from "@/lib/settings/public";
import { mediaUrl } from "@/lib/admin/media-shared";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Icon() {
  const settings = await getPublicSettings();
  if (settings.favicon_path) {
    const response = await fetch(mediaUrl("site-media", settings.favicon_path), { cache: "no-store" });
    if (!response.ok) throw new Error(`Не вдалося завантажити favicon: ${response.status}`);
    const image = await sharp(Buffer.from(await response.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .resize(32, 32, { fit: "contain" }).png().toBuffer();
    return new Response(Uint8Array.from(image), { headers: { "Content-Type": contentType } });
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#18181b",
          color: "#fafafa",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 7,
        }}
      >
        T
      </div>
    ),
    size,
  );
}
