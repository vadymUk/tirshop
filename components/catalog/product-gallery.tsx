"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product/product-image";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

type GalleryImage = { id: string; storage_path: string; alt_text: string | null };

export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const selected = images[index] ?? null;

  return (
    <div className="space-y-3">
      <ProductImage
        key={selected?.id ?? "placeholder"}
        storagePath={selected?.storage_path ?? null}
        alt={selected?.alt_text || productName}
        preset="detail"
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority
        className="aspect-square w-full rounded-lg border object-cover"
      />
      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label={t("Product images")}>
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t("Show image {index} of {total}").replace("{index}", String(i + 1)).replace("{total}", String(images.length))}
                aria-current={i === index}
                className={cn(
                  "block w-full overflow-hidden rounded-md border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <ProductImage
                  storagePath={image.storage_path}
                  alt=""
                  preset="thumbnail"
                  sizes="(min-width: 640px) 10vw, 20vw"
                  className="aspect-square w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
