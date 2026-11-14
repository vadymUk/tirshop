"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ProductImage } from "@/components/product/product-image";
import { adjustInventory } from "@/lib/admin/inventory-actions";
import { stockStatus, type InventoryItem } from "@/lib/admin/inventory";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC" : "Немає запису";
const control = "min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900";

export function InventoryList({ items }: { items: InventoryItem[] }) {
  const [state, action, pending] = useActionState(adjustInventory, {});
  return <form action={action} className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
      <label className="flex flex-col gap-1 text-sm font-medium">Дія<select name="operation" className={control}><option value="set">Встановити</option><option value="increase">Збільшити на</option><option value="decrease">Зменшити на</option></select></label>
      <label className="flex w-36 flex-col gap-1 text-sm font-medium">Кількість<input name="quantity" type="number" min="0" max="1000000000" step="1" required className={control} /></label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">Причина<input name="reason" maxLength={1000} required className={control} /></label>
      <button disabled={pending} className="min-h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? "Збереження…" : "Застосувати до вибраних"}</button>
    </div>
    <p className="px-4 pt-3 text-xs text-slate-500">Операція застосовується до вибраних товарів поточної сторінки. Якщо залишок змінився, усю операцію буде відхилено.</p>
    {state.error && <p role="alert" className="px-4 pt-3 text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="px-4 pt-3 text-sm text-green-700">{state.success}</p>}
    {!items.length && <p className="p-8 text-center text-sm text-slate-500">Товарів не знайдено.</p>}
    <div className="divide-y divide-slate-100">{items.map((item) => <div key={item.id} className="flex min-w-0 items-start gap-3 p-4">
      <input type="checkbox" name="items" value={`${item.id}:${item.stock_quantity}`} aria-label={`Вибрати ${item.name}`} className="mt-4 size-5 shrink-0" />
      <div className="size-16 shrink-0 overflow-hidden rounded-lg"><ProductImage storagePath={item.image_path} alt={item.name} className="size-16 object-cover" /></div>
      <div className="min-w-0 flex-1"><Link href={`/admin/inventory/${item.id}`} className="break-words font-semibold text-blue-700 hover:underline">{item.name}</Link>
        <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          <span>SKU: {item.sku ?? "—"}</span><span>Залишок: {item.stock_quantity}</span><span>Поріг: {item.threshold}</span>
          <span>Стан: {stockStatus(item)}</span><span>{item.is_active ? "Активний" : "Неактивний"}</span><span>Остання зміна: {date(item.last_stock_update)}</span>
        </div>
      </div>
    </div>)}</div>
  </form>;
}
