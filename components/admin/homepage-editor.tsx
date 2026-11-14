"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { ConfirmDialog, DeleteDialog } from "@/components/admin/confirm-dialog";
import { publishHomepage, saveHomepageDraft } from "@/lib/admin/homepage-actions";
import { sectionLabels, type HomeBanner, type HomeSection, type HomepageDocument } from "@/lib/homepage/schema";

type Choice = { id: string; name: string; is_active: boolean };
const input = "min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium";
const dateInput = (value: string) => value ? value.slice(0, 16) : "";

function EditorDetails({ initiallyOpen, children }: { initiallyOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="rounded-xl border bg-white p-4" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>{children}</details>;
}

export function HomepageEditor({ document: initial, revision: initialRevision, products, categories }: { document: HomepageDocument; revision: number; products: Choice[]; categories: Choice[] }) {
  const [document, setDocument] = useState(initial);
  const [revision, setRevision] = useState(initialRevision);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const change = (next: HomepageDocument) => { setDocument(next); setDirty(true); setMessage(""); };
  const section = (index: number, patch: Partial<HomeSection>) => change({ ...document, sections: document.sections.map((s, i) => i === index ? { ...s, ...patch } : s) });
  const settings = (index: number, patch: Partial<HomeSection["settings"]>) => section(index, { settings: { ...document.sections[index].settings, ...patch } });
  const banner = (index: number, patch: Partial<HomeBanner>) => change({ ...document, banners: document.banners.map((b, i) => i === index ? { ...b, ...patch } : b) });
  const save = () => startTransition(async () => {
    try { setError(""); const next = await saveHomepageDraft(document, revision); setRevision(next); setDirty(false); setMessage("Чернетку збережено. Вона ще не опублікована."); }
    catch (e) { setError(e instanceof Error ? e.message : "Не вдалося зберегти чернетку."); }
  });
  const publish = () => startTransition(async () => {
    try { setError(""); const next = dirty || !revision ? await saveHomepageDraft(document, revision) : revision; setRevision(next); setDirty(false); await publishHomepage(next); setMessage("Зміни опубліковано."); }
    catch (e) { setError(e instanceof Error ? e.message : "Не вдалося опублікувати."); }
  });
  const addBanner = () => change({ ...document, banners: [...document.banners, { id: crypto.randomUUID(), title: "", subtitle: "", image_path: "", mobile_image_path: "", button_text: "", button_url: "", position: "middle", sort_order: document.banners.length * 10, starts_at: "", ends_at: "", is_active: false }] });
  return <div className="space-y-4">
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
      <button disabled={pending} onClick={save} className="min-h-10 rounded bg-slate-900 px-4 text-sm text-white disabled:opacity-50">Зберегти чернетку</button>
      {dirty || !revision ? <span className="rounded border px-4 py-2 text-sm opacity-50">Переглянути чернетку</span> : <Link href="/admin/homepage/preview" target="_blank" className="rounded border px-4 py-2 text-sm">Переглянути чернетку</Link>}
      <ConfirmDialog trigger={<button disabled={pending} className="min-h-10 rounded bg-blue-700 px-4 text-sm text-white disabled:opacity-50">Опублікувати</button>} title="Опублікувати головну сторінку?" description="Зміни чернетки замінять поточні опубліковані секції та банери." confirmLabel="Опублікувати" onConfirm={publish} />
      <span className="text-sm text-slate-500">{dirty ? "Є незбережені зміни" : `Версія чернетки: ${revision || "не створена"}`}</span>
    </div>
    <p className="text-sm text-slate-600">Для попереднього перегляду спочатку збережіть чернетку. Зображення завантажуйте у <Link href="/admin/media?bucket=site-media" target="_blank" className="text-blue-700 underline">медіатеку сайту</Link> та вставляйте шлях файлу. Час банерів — UTC.</p>
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="break-words rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <fieldset disabled={pending} className="space-y-3">
      <h2 className="text-xl font-bold">Секції</h2>
      {document.sections.map((s, index) => <EditorDetails key={s.id} initiallyOpen={s.section_type === "hero"}>
        <summary className="cursor-pointer font-semibold">{sectionLabels[s.section_type] ?? s.section_type}: {s.title || s.section_key} {s.is_visible ? "" : "(приховано)"}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={label}>Заголовок<input className={input} value={s.title} maxLength={200} onChange={(e) => section(index, { title: e.target.value })} /></label>
          <label className={label}>Підзаголовок<input className={input} value={s.subtitle} maxLength={500} onChange={(e) => section(index, { subtitle: e.target.value })} /></label>
          <label className={`${label} sm:col-span-2`}>Опис / текст (без HTML)<textarea className={input} rows={4} maxLength={5000} value={s.content} onChange={(e) => section(index, { content: e.target.value })} /></label>
          {s.section_type === "hero" && <>
            <label className={label}>Зображення для комп’ютера (шлях)<input className={input} value={s.settings.desktop_image} onChange={(e) => settings(index, { desktop_image: e.target.value })} /></label>
            <label className={label}>Зображення для телефону (шлях)<input className={input} value={s.settings.mobile_image} onChange={(e) => settings(index, { mobile_image: e.target.value })} /></label>
          </>}
          <label className={label}>Текст основної кнопки<input className={input} value={s.settings.primary_text} onChange={(e) => settings(index, { primary_text: e.target.value })} /></label>
          <label className={label}>URL основної кнопки<input className={input} value={s.settings.primary_url} onChange={(e) => settings(index, { primary_url: e.target.value })} /></label>
          <label className={label}>Текст додаткової кнопки<input className={input} value={s.settings.secondary_text} onChange={(e) => settings(index, { secondary_text: e.target.value })} /></label>
          <label className={label}>URL додаткової кнопки<input className={input} value={s.settings.secondary_url} onChange={(e) => settings(index, { secondary_url: e.target.value })} /></label>
          {s.section_type === "featured_products" && <label className={`${label} sm:col-span-2`}>Товари (не більше 24; Ctrl/Cmd для вибору кількох). Активні товари з позначкою «Рекомендований» додаються автоматично.<select multiple className={`${input} h-40`} value={s.settings.product_ids} onChange={(e) => settings(index, { product_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (неактивний)"}</option>)}</select></label>}
          {s.section_type === "featured_categories" && <label className={`${label} sm:col-span-2`}>Категорії (не більше 24; Ctrl/Cmd для вибору кількох)<select multiple className={`${input} h-40`} value={s.settings.category_ids} onChange={(e) => settings(index, { category_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}>{categories.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (неактивна)"}</option>)}</select></label>}
          <label className={label}>Порядок<input type="number" min="0" max="100000" className={input} value={s.sort_order} onChange={(e) => section(index, { sort_order: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.is_visible} onChange={(e) => section(index, { is_visible: e.target.checked })} /> Показувати секцію</label>
        </div>
      </EditorDetails>)}
      <div id="banners" className="flex flex-wrap items-center justify-between gap-2 pt-4"><h2 className="text-xl font-bold">Промоційні банери</h2><button type="button" onClick={addBanner} className="rounded border px-4 py-2 text-sm">Додати банер</button></div>
      {document.banners.map((b, index) => <EditorDetails key={b.id} initiallyOpen={!b.title}>
        <summary className="cursor-pointer font-semibold">{b.title || "Новий банер"} {b.is_active ? "" : "(неактивний)"}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={label}>Назва<input className={input} value={b.title} maxLength={200} onChange={(e) => banner(index, { title: e.target.value })} /></label>
          <label className={label}>Підзаголовок<input className={input} value={b.subtitle} maxLength={500} onChange={(e) => banner(index, { subtitle: e.target.value })} /></label>
          <label className={label}>Зображення для комп’ютера (шлях)<input className={input} value={b.image_path} onChange={(e) => banner(index, { image_path: e.target.value })} /></label>
          <label className={label}>Зображення для телефону (шлях)<input className={input} value={b.mobile_image_path} onChange={(e) => banner(index, { mobile_image_path: e.target.value })} /></label>
          <label className={label}>Текст кнопки<input className={input} value={b.button_text} onChange={(e) => banner(index, { button_text: e.target.value })} /></label>
          <label className={label}>URL кнопки<input className={input} value={b.button_url} onChange={(e) => banner(index, { button_url: e.target.value })} /></label>
          <label className={label}>Розташування<select className={input} value={b.position} onChange={(e) => banner(index, { position: e.target.value as HomeBanner["position"] })}><option value="hero">Після головного блоку</option><option value="top">Вгорі</option><option value="middle">Посередині</option><option value="bottom">Внизу</option></select></label>
          <label className={label}>Порядок<input className={input} type="number" min="0" max="100000" value={b.sort_order} onChange={(e) => banner(index, { sort_order: Number(e.target.value) })} /></label>
          <label className={label}>Початок (UTC)<input className={input} type="datetime-local" value={dateInput(b.starts_at)} onChange={(e) => banner(index, { starts_at: e.target.value ? `${e.target.value}:00Z` : "" })} /></label>
          <label className={label}>Завершення (UTC)<input className={input} type="datetime-local" value={dateInput(b.ends_at)} onChange={(e) => banner(index, { ends_at: e.target.value ? `${e.target.value}:00Z` : "" })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.is_active} onChange={(e) => banner(index, { is_active: e.target.checked })} /> Активний</label>
          <DeleteDialog trigger={<button type="button" className="text-left text-sm text-red-700 underline">Видалити з чернетки</button>} title="Видалити банер?" description="Банер буде видалено з публічної сторінки після публікації чернетки. Зображення залишаться в медіатеці." onConfirm={() => change({ ...document, banners: document.banners.filter((_, i) => i !== index) })} />
        </div>
      </EditorDetails>)}
    </fieldset>
  </div>;
}
