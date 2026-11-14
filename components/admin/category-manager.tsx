"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import { deleteCategory, moveCategory, saveCategory } from "@/lib/admin/category-actions";
import type { Category } from "@/types/database";

export type CategoryItem = Category & { product_count: number; imageSrc: string | null };
type Choice = { id: string; name: string };
const control = "min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const label = "flex flex-col gap-1 text-sm font-medium text-slate-700";

function CategoryForm({ category }: { category?: CategoryItem }) {
  const [state, action, pending] = useActionState(saveCategory, {});
  return <form action={action} className="grid gap-3 p-4 sm:grid-cols-2">
    <input name="id" type="hidden" value={category?.id ?? ""} />
    <label className={label}>Назва<input className={control} name="name" defaultValue={category?.name} maxLength={120} required /></label>
    <label className={label}>Slug<input className={control} name="slug" defaultValue={category?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={200} required /></label>
    <label className={`${label} sm:col-span-2`}>Опис<textarea className={control} name="description" defaultValue={category?.description ?? ""} maxLength={20000} /></label>
    <label className={label}>Порядок<input className={control} name="sort_order" type="number" min="0" max="1000000" step="1" defaultValue={category?.sort_order ?? 0} required /></label>
    <label className="flex items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked={category?.is_active ?? true} /> Активна</label>
    <label className={label}>SEO title<input className={control} name="meta_title" defaultValue={category?.meta_title ?? ""} maxLength={200} /></label>
    <label className={label}>SEO description<input className={control} name="meta_description" defaultValue={category?.meta_description ?? ""} maxLength={500} /></label>
    {state.error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700 sm:col-span-2">{state.success}</p>}
    <button disabled={pending} className="min-h-10 rounded-md bg-slate-900 px-4 text-sm text-white sm:col-span-2">{pending ? "Збереження…" : "Зберегти категорію"}</button>
  </form>;
}

function DeleteForm({ category, choices }: { category: CategoryItem; choices: Choice[] }) {
  const [state, action, pending] = useActionState(deleteCategory, {});
  return <form action={action} onSubmit={(event) => {
    if (!window.confirm(`Видалити категорію «${category.name}»? Її товари будуть перенесені до обраної категорії.`)) event.preventDefault();
  }} className="space-y-3 border-t border-slate-100 p-4">
    <input type="hidden" name="id" value={category.id} />
    <label className={label}>Перенести товари до<select name="target" className={control} defaultValue=""><option value="">Не переносити (лише для порожньої категорії)</option>{choices.filter((choice) => choice.id !== category.id).map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
    <button disabled={pending} className="min-h-10 rounded-md border border-red-300 px-4 text-sm text-red-700">Видалити категорію</button>
  </form>;
}

export function CategoryManager({ categories, choices }: { categories: CategoryItem[]; choices: Choice[] }) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const move = (id: string, target: string) => {
    if (id === target || pending) return;
    startTransition(async () => { const result = await moveCategory(id, target); setMessage(result.error ?? result.success ?? ""); });
  };
  return <div className="space-y-4">
    <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer p-4 font-semibold">Додати категорію</summary><CategoryForm /></details>
    <p className="text-sm text-slate-500">Перетягніть категорію перед іншою або використайте кнопки порядку. Порядок діє для всіх категорій.</p>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    {!categories.length && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Категорій не знайдено.</div>}
    {categories.map((category, index) => <section key={category.id} draggable={!pending} onDragStart={() => setDragged(category.id)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragged) move(dragged, category.id); setDragged(null); }} className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start gap-3 p-4"><GripVertical className="mt-1 size-5 shrink-0 text-slate-400" aria-hidden="true" />{category.imageSrc && <Image src={category.imageSrc} alt="" width={64} height={64} unoptimized className="size-16 rounded object-cover" />}<div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{category.name}</h2><p className="mt-1 break-words text-sm text-slate-500">/{category.slug} · {category.is_active ? "Активна" : "Неактивна"} · Порядок: {category.sort_order}</p><p className="mt-2 break-words text-sm text-slate-600">{category.description || "Без опису"}</p><p className="mt-2 text-sm text-slate-500">Товарів: {category.product_count} · Оновлено: {new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(category.updated_at))}</p><Link className="mt-2 inline-block text-sm text-blue-700 underline" href={`/admin/products?category=${category.id}`}>Переглянути товари</Link></div><div className="flex gap-2"><button type="button" disabled={pending || index === 0} onClick={() => move(category.id, categories[index - 1].id)} className="min-h-10 rounded border px-3 disabled:opacity-40" aria-label={`Перемістити ${category.name} вгору`}>↑</button><button type="button" disabled={pending || index >= categories.length - 1} onClick={() => move(categories[index + 1].id, category.id)} className="min-h-10 rounded border px-3 disabled:opacity-40" aria-label={`Перемістити ${category.name} вниз`}>↓</button></div></div>
      <details className="border-t border-slate-100"><summary className="cursor-pointer p-4 text-sm font-medium">Редагувати</summary><CategoryForm category={category} /><DeleteForm category={category} choices={choices} /></details>
    </section>)}
  </div>;
}
