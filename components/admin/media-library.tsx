"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { DeleteDialog } from "@/components/admin/confirm-dialog";
import { attachMedia, deleteMedia, uploadMedia } from "@/lib/admin/media-actions";
import { mediaBucket, mediaUrl, type MediaBucket } from "@/lib/admin/media-shared";
import { validateImageFile } from "@/lib/storage/validation";
import { transformsEnabled } from "@/lib/storage/urls";
import type { Database } from "@/types/database";

type Media = Database["public"]["Functions"]["admin_media_list"]["Returns"][number];

export function MediaLibrary({ bucket, rows, product }: { bucket: MediaBucket; rows: Media[]; product: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const upload = (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return;
    if (selected.length > 20) { setError("За раз можна завантажити не більше 20 файлів."); return; }
    startTransition(async () => {
      setError(""); setMessage("");
      const failures: string[] = [];
      let success = 0;
      for (const file of selected) {
        const valid = validateImageFile(file);
        if (!valid.ok) { failures.push(`${file.name}: ${valid.message}`); continue; }
        try {
          const form = new FormData(); form.set("file", file); form.set("bucket", bucket);
          await uploadMedia(form); success++;
        } catch (e) { failures.push(`${file.name}: ${e instanceof Error ? e.message : "Помилка завантаження"}`); }
      }
      if (success) setMessage(`Завантажено файлів: ${success}. Усі файли перетворено на WebP.`);
      if (failures.length) setError(failures.join(" · "));
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    });
  };
  const run = (action: () => Promise<void>, success: string) => startTransition(async () => {
    try { setError(""); setMessage(""); await action(); setMessage(success); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Операція не виконана."); }
  });
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setError(""); setMessage("Скопійовано."); }
    catch { setError("Не вдалося скопіювати. Скопіюйте текст вручну."); }
  };
  return <>
    <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!pending) upload(event.dataTransfer.files); }} className="mb-4 rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center">
      <p className="text-sm">Перетягніть файли сюди або виберіть JPG, PNG чи WebP (до 8 МБ, не більше 20 за раз). SVG заборонено.</p>
      <label className="mt-3 inline-block cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm text-white">Вибрати файли<input ref={fileInput} className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple disabled={pending} onChange={(event) => { if (event.target.files) upload(event.target.files); }} /></label>
      {pending && <p className="mt-2 text-sm">Виконується операція…</p>}
    </div>
    {message && <p role="status" className="mb-3 rounded bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {error && <p role="alert" className="mb-3 break-words rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!rows.length && <p className="rounded-xl border bg-white p-8 text-center text-slate-500">Файлів не знайдено.</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map((row) => {
      const parsed = mediaBucket.parse(row.bucket);
      const url = mediaUrl(parsed, row.path);
      return <article key={`${row.bucket}:${row.path}`} className="min-w-0 rounded-xl border bg-white p-3 text-sm">
        {row.mime_type === "image/svg+xml" || row.path.toLowerCase().endsWith(".svg") ? <div className="flex aspect-square items-center justify-center rounded bg-slate-50 text-slate-500">SVG не підтримується</div> :
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Відкрити ${row.original_name}`}><Image src={mediaUrl(parsed, row.path, true)} alt={row.original_name} width={240} height={240} unoptimized={transformsEnabled} className="aspect-square w-full rounded bg-slate-50 object-contain" /></a>}
        <p className="mt-2 break-all font-semibold">{row.original_name}</p><p className="break-all text-xs text-slate-500">{row.path}</p>
        <p className="mt-2 text-slate-600">{row.mime_type ?? "Тип невідомий"} · {row.size === null ? "Розмір невідомий" : `${(row.size / 1024).toFixed(1)} КБ`}</p>
        <p className="text-slate-600">{row.width && row.height ? `${row.width} × ${row.height} px` : "Розміри невідомі"} · {new Date(row.created_at).toLocaleDateString("uk-UA", { timeZone: "UTC" })} UTC</p>
        <p className="mt-1 text-slate-600">{row.deleting ? "Видалення потребує повтору" : row.referenced ? "Є посилання в базі" : "Немає відомих посилань у базі"}</p>
        {!row.managed && <p className="text-amber-700">Старий файл: перед видаленням потрібна ручна перевірка.</p>}
        <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => copy(url)} className="text-blue-700 underline">Копіювати URL</button><button type="button" onClick={() => copy(row.path)} className="text-blue-700 underline">Копіювати шлях</button>
          {product && !row.deleting && <button type="button" disabled={pending} className="text-blue-700 underline" onClick={() => run(() => attachMedia({ bucket: parsed, path: row.path, product }), "Копію додано до товару.")}>Додати до товару</button>}
          {row.managed && !row.referenced && <DeleteDialog trigger={<button type="button" disabled={pending} className="text-red-700 underline">Видалити</button>} title="Видалити файл?" description="Посилання у базі перевірять повторно. Переконайтеся, що URL не використовується поза базою: файл стане недоступним." onConfirm={() => run(() => deleteMedia({ bucket: parsed, path: row.path }), "Файл видалено.")} />}
        </div>
      </article>;
    })}</div>
  </>;
}
