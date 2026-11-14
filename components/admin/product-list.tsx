"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ProductImage } from "@/components/product/product-image";
import { bulkProducts, saveLowStockThreshold } from "@/lib/admin/product-actions";

export type ProductListItem = {
  id: string; name: string; sku: string | null; category: string; price: number;
  compare: number | null; currency: string; stock: number; active: boolean; featured: boolean;
  created: string; updated: string; image: string | null;
};
const date = (value: string) => new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));

export function StockThresholdForm({ threshold }: { threshold: number }) {
  const [state, action, pending] = useActionState(saveLowStockThreshold, {});
  return <form action={action} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"><label className="flex flex-col gap-1 text-sm text-slate-700">Спільний поріг низького залишку<input name="threshold" type="number" min="0" max="1000000" step="1" defaultValue={threshold} className="h-10 w-40 rounded-md border border-slate-300 px-3" required /></label><button disabled={pending} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm">Зберегти поріг</button>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}</form>;
}

export function ProductList({ products, threshold }: { products: ProductListItem[]; threshold: number }) {
  const [state, action, pending] = useActionState(bulkProducts, {});
  return <form action={action} onSubmit={(event) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value === "delete" && !window.confirm("Видалити вибрані товари? Товари з історією замовлень або зображеннями видалити неможливо.")) event.preventDefault();
  }}>
    <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
      <button name="operation" value="activate" disabled={pending} className="min-h-10 rounded border border-slate-200 px-3 text-sm">Активувати</button>
      <button name="operation" value="deactivate" disabled={pending} className="min-h-10 rounded border border-slate-200 px-3 text-sm">Деактивувати</button>
      <button name="operation" value="delete" disabled={pending} className="min-h-10 rounded border border-red-300 px-3 text-sm text-red-700">Видалити</button>
    </div>
    {state.error && <p role="alert" className="m-4 text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="m-4 text-sm text-green-700">{state.success}</p>}
    {products.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Товарів не знайдено.</p>}
    <div className="divide-y divide-slate-100">{products.map((p) => <div key={p.id} className="flex min-w-0 items-start gap-3 p-4">
      <input type="checkbox" name="ids" value={p.id} aria-label={`Вибрати ${p.name}`} className="mt-4 size-5 shrink-0" />
      <div className="size-16 shrink-0 overflow-hidden rounded-lg"><ProductImage storagePath={p.image} alt={p.name} className="size-16 object-cover" /></div>
      <div className="min-w-0 flex-1"><Link href={`/admin/products/${p.id}/edit`} className="break-words font-semibold text-blue-700 hover:underline">{p.name}</Link>
        <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <span>SKU: {p.sku ?? "—"}</span><span>Категорія: {p.category}</span><span>Ціна: {p.price} {p.currency}</span><span>Порівняння: {p.compare === null ? "—" : `${p.compare} ${p.currency}`}</span>
          <span>Залишок: {p.stock} {p.stock === 0 ? "(немає)" : p.stock <= threshold ? "(мало)" : ""}</span><span>{p.active ? "Активний" : "Неактивний"}</span><span>Рекомендований: {p.featured ? "так" : "ні"}</span><span>Створено: {date(p.created)}</span><span>Змінено: {date(p.updated)}</span>
        </div>
      </div>
    </div>)}</div>
  </form>;
}
