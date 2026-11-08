"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { IMAGE_PRESETS, type ImagePreset } from "@/lib/storage/constants";
import {
  getProductImageOriginalUrl,
  supabaseImageLoader,
  transformsEnabled,
} from "@/lib/storage/urls";

type ProductImageProps = {
  storagePath: string | null;
  alt: string;
  preset?: ImagePreset;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

export function ProductImage({
  storagePath,
  alt,
  preset = "card",
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority,
  className,
}: ProductImageProps) {
  if (!storagePath) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="flex aspect-square items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <ImageOff className="size-8" aria-hidden="true" />
      </div>
    );
  }

  const { width } = IMAGE_PRESETS[preset];

  return (
    <Image
      // With transformations enabled, src is the storage path and the loader builds the URL.
      src={transformsEnabled ? storagePath : getProductImageOriginalUrl(storagePath)}
      loader={transformsEnabled ? supabaseImageLoader : undefined}
      alt={alt}
      width={width}
      height={width}
      sizes={sizes}
      priority={priority}
      className={className ?? "aspect-square w-full rounded-md object-cover"}
    />
  );
}
