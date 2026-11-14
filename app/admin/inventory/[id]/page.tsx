import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminDataTable, AdminPageHeading } from "@/components/admin/admin-ui";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const pageSize = 20;
export default async function InventoryHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string | string[] }> }) {
  await requireActiveAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const rawPage = (await searchParams).page ?? "1";
  if (typeof rawPage !== "string" || !/^[1-9]\d{0,6}$/.test(rawPage)) notFound();
  const page = Number(rawPage);
  const db = await createClient();
  const [product, history] = await Promise.all([
    db.from("products").select("id,name,sku,stock_quantity").eq("id", id).maybeSingle(),
    db.from("inventory_logs").select("id,admin_user_id,previous_quantity,new_quantity,quantity_change,reason,created_at")
      .eq("product_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize),
  ]);
  if (product.error || history.error) throw new Error(`Не вдалося завантажити історію складу: ${product.error?.message ?? history.error?.message}`);
  if (!product.data) notFound();
  const rows = history.data ?? [];
  return <><AdminPageHeading title={product.data.name} description={`SKU: ${product.data.sku ?? "—"} · Поточний залишок: ${product.data.stock_quantity}`} action={<Link href="/admin/inventory" className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm">До складу</Link>} />
    <p className="mb-4 text-sm text-slate-600">Історія доступна з моменту підключення журналу. Операції checkout виконуються системою; для старих записів причина або адміністратор можуть бути відсутні.</p>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><AdminDataTable columns={["Дата UTC", "Було", "Стало", "Зміна", "Причина", "ID адміністратора"]} rows={rows.slice(0, pageSize).map((row) => ({
      id: row.id, cells: [new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(row.created_at)), row.previous_quantity === null ? "—" : String(row.previous_quantity), String(row.new_quantity), String(row.quantity_change), row.reason ?? "Не зазначено", row.admin_user_id ?? "Система / невідомо"],
    }))} /></div>
    <nav aria-label="Сторінки історії" className="mt-4 flex gap-4 text-sm"><span>Сторінка {page}</span>{page > 1 && <Link href={`?page=${page - 1}`} className="text-blue-700 underline">Назад</Link>}{rows.length > pageSize && <Link href={`?page=${page + 1}`} className="text-blue-700 underline">Далі</Link>}</nav>
  </>;
}
