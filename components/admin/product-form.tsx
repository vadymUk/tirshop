"use client";

import { useActionState } from "react";
import { saveProduct } from "@/lib/admin/product-actions";
import type { Product } from "@/types/database";

type Category = { id: string; name: string };
type ProductFormData = Pick<Product, "id" | "name" | "slug" | "sku" | "category_id" | "short_description" | "description" | "price" | "compare_at_price" | "currency" | "stock_quantity" | "weight" | "is_active" | "is_featured" | "meta_title" | "meta_description" | "og_image_path">;
const input = "h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-2 focus:outline-blue-600";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700";

export function ProductForm({ product, categories, saved, defaultCurrency = "EUR" }: { product?: ProductFormData; categories: Category[]; saved?: boolean; defaultCurrency?: string }) {
  const [state, action, pending] = useActionState(saveProduct, {});
  return <form action={action} className="space-y-5">
    <input type="hidden" name="id" value={product?.id ?? ""} />
    <input type="hidden" name="expected_stock" value={product?.stock_quantity ?? ""} />
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{state.error}</p>}
    {saved && !state.error && <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">Товар збережено.</p>}
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <label className={label}>Назва<input className={input} name="name" defaultValue={product?.name} maxLength={200} required /></label>
      <label className={label}>Slug<input className={input} name="slug" defaultValue={product?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={200} required /></label>
      <label className={label}>SKU<input className={input} name="sku" defaultValue={product?.sku ?? ""} maxLength={100} /></label>
      <label className={label}>Категорія<select className={input} name="category_id" defaultValue={product?.category_id ?? ""} required><option value="">Оберіть категорію</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className={`${label} sm:col-span-2`}>Короткий опис<textarea className={`${input} h-20 py-2`} name="short_description" defaultValue={product?.short_description ?? ""} maxLength={1000} /></label>
      <label className={`${label} sm:col-span-2`}>Повний опис<textarea className={`${input} h-32 py-2`} name="description" defaultValue={product?.description ?? ""} maxLength={20000} /></label>
      <label className={label}>Ціна<input className={input} name="price" type="number" step="0.01" min="0.01" defaultValue={product?.price} required /></label>
      <label className={label}>Ціна для порівняння<input className={input} name="compare_at_price" type="number" step="0.01" min="0" defaultValue={product?.compare_at_price ?? ""} /></label>
      <label className={label}>Валюта (ISO)<input className={input} name="currency" defaultValue={product?.currency ?? defaultCurrency} pattern="[A-Z]{3}" required /></label>
      <label className={label}>Залишок<input className={input} name="stock_quantity" type="number" step="1" min="0" max="1000000000" defaultValue={product?.stock_quantity ?? 0} required /></label>
      <label className={label}>Вага<input className={input} name="weight" type="number" step="0.001" min="0" defaultValue={product?.weight ?? ""} /></label>
      <div className="flex flex-wrap gap-5 pt-4 text-sm"><label><input name="is_active" type="checkbox" defaultChecked={product?.is_active ?? true} /> Активний</label><label><input name="is_featured" type="checkbox" defaultChecked={product?.is_featured ?? false} /> Рекомендований</label></div>
      <label className={label}>SEO title<input className={input} name="meta_title" maxLength={200} defaultValue={product?.meta_title ?? ""} /></label>
      <label className={label}>SEO description<input className={input} name="meta_description" maxLength={500} defaultValue={product?.meta_description ?? ""} /></label>
      <label className={`${label} sm:col-span-2`}>Шлях OG-зображення у site-media<input className={input} name="og_image_path" maxLength={500} defaultValue={product?.og_image_path ?? ""} /></label>
    </section>
    {!product && <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Зображення можна додати після створення товару.</p>}
    <button disabled={pending || categories.length === 0} className="min-h-11 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white disabled:opacity-50">{pending ? "Збереження…" : "Зберегти товар"}</button>
    {categories.length === 0 && <p className="text-sm text-red-700">Спочатку створіть категорію.</p>}
  </form>;
}
