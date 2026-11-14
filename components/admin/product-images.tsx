"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { DeleteDialog } from "@/components/admin/confirm-dialog";
import { detachMedia } from "@/lib/admin/media-actions";
import { mediaUrl } from "@/lib/admin/media-shared";
import { transformsEnabled } from "@/lib/storage/urls";

export function ProductImages({ product, images }: { product: string; images: { id: string; storage_path: string; alt_text: string | null }[] }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Зображення товару ({images.length}/10)</h2><Link className="text-sm text-blue-700 underline" href={`/admin/media?bucket=product-images&product=${product}`}>Обрати з медіатеки</Link></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!images.length && <p className="mt-3 text-sm text-slate-500">Зображень немає.</p>}
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image) => <div key={image.id} className="min-w-0 rounded border p-2">
      <Image src={mediaUrl("product-images", image.storage_path, true)} alt={image.alt_text ?? ""} width={240} height={240} unoptimized={transformsEnabled} className="aspect-square w-full object-contain" />
      <DeleteDialog trigger={<button disabled={pending} className="mt-2 text-sm text-red-700 underline">Відв’язати</button>} title="Відв’язати зображення?" description="Файл залишиться у сховищі і його можна буде перевірити в медіатеці." onConfirm={() => startTransition(async () => { try { setError(""); await detachMedia({ id: image.id, product }); } catch (e) { setError(e instanceof Error ? e.message : "Не вдалося відв’язати зображення."); } })} />
    </div>)}</div>
  </section>;
}
