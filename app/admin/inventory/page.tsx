import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { InventoryList } from "@/components/admin/inventory-list";
import { getInventory } from "@/lib/admin/inventory-data";
import { inventoryPageSize, parseInventoryFilter } from "@/lib/admin/inventory";

const control = "min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm";
export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseInventoryFilter(await searchParams);
  if (!parsed.filter) return <><AdminPageHeading title="Склад" description="Керування залишками." /><p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{parsed.error}</p><Link href="/admin/inventory" className="mt-3 inline-block text-blue-700 underline">Скинути фільтри</Link></>;
  const filter = parsed.filter;
  const rows = await getInventory(filter, (filter.page - 1) * inventoryPageSize, inventoryPageSize + 1);
  const query = new URLSearchParams({ q: filter.query, status: filter.status });
  const pageUrl = (page: number) => { const params = new URLSearchParams(query); params.set("page", String(page)); return `?${params}`; };
  return <>
    <AdminPageHeading title="Склад" description="Залишки всіх товарів; поріг задається в налаштуваннях магазину." action={<a href={`/admin/inventory/export?${query}`} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium">Експортувати CSV</a>} />
    <form className="mb-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="min-w-40 flex-1"><span className="sr-only">Назва або SKU</span><input name="q" defaultValue={filter.query} maxLength={100} placeholder="Назва або SKU" className={`${control} w-full`} /></label>
      <label><span className="sr-only">Стан залишку</span><select name="status" defaultValue={filter.status} className={control}><option value="all">Усі залишки</option><option value="in">В наявності</option><option value="low">Малий залишок</option><option value="out">Немає в наявності</option></select></label>
      <button className="min-h-10 rounded-md bg-slate-900 px-4 text-sm text-white">Знайти</button>
    </form>
    <InventoryList items={rows.slice(0, inventoryPageSize)} />
    <nav aria-label="Сторінки складу" className="mt-4 flex flex-wrap items-center gap-4 text-sm"><span>Сторінка {filter.page}</span>{filter.page > 1 && <Link href={pageUrl(filter.page - 1)} className="text-blue-700 underline">Назад</Link>}{rows.length > inventoryPageSize && <Link href={pageUrl(filter.page + 1)} className="text-blue-700 underline">Далі</Link>}</nav>
  </>;
}
