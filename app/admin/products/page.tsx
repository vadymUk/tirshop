import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ProductList, StockThresholdForm } from "@/components/admin/product-list";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { parseProductListParams } from "@/lib/admin/product-list";
import { createClient } from "@/lib/supabase/server";

const control = "min-h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900";
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveAdmin();
  const raw = await searchParams;
  const f = parseProductListParams(raw);
  const db = await createClient();
  const [categories, settings] = await Promise.all([db.from("categories").select("id,name").order("name"), db.rpc("get_admin_site_settings")]);
  if (categories.error || settings.error || !settings.data?.[0]) throw new Error(`Failed to load product filters: ${categories.error?.message ?? settings.error?.message ?? "missing settings"}`);
  const threshold = settings.data[0].low_stock_threshold;
  const sort = {
    newest: ["created_at", false], oldest: ["created_at", true], name: ["name", true],
    price_asc: ["price", true], price_desc: ["price", false], stock_asc: ["stock_quantity", true], stock_desc: ["stock_quantity", false],
  } as const;
  const [column, ascending] = sort[f.sort as keyof typeof sort];
  const start = (f.page - 1) * 20;
  let request = db.from("products").select("id,name,sku,price,compare_at_price,currency,stock_quantity,is_active,is_featured,created_at,updated_at,categories(name),product_images(storage_path,sort_order)")
    .order(column, { ascending }).order("id").order("sort_order", { referencedTable: "product_images" }).limit(1, { referencedTable: "product_images" }).range(start, start + 20);
  if (f.q) { const term = f.q.replace(/_/g, "\\_"); request = request.or(`name.ilike.*${term}*,sku.ilike.*${term}*,slug.ilike.*${term}*`); }
  if (f.category) request = request.eq("category_id", f.category);
  if (f.status) request = request.eq("is_active", f.status === "active");
  if (f.stock === "out") request = request.eq("stock_quantity", 0);
  if (f.stock === "low") request = request.gt("stock_quantity", 0).lte("stock_quantity", threshold);
  if (f.stock === "in") request = request.gt("stock_quantity", threshold);
  if (f.min !== undefined) request = request.gte("price", f.min);
  if (f.max !== undefined) request = request.lte("price", f.max);
  const result = await request;
  if (result.error && result.error.code !== "PGRST103") throw new Error(`Failed to load products: ${result.error.message}`);
  const rows = result.data ?? [];
  const items = rows.slice(0, 20).map((p) => ({ id: p.id, name: p.name, sku: p.sku, category: p.categories?.name ?? "—", price: p.price, compare: p.compare_at_price, currency: p.currency, stock: p.stock_quantity, active: p.is_active, featured: p.is_featured, created: p.created_at, updated: p.updated_at, image: p.product_images?.[0]?.storage_path ?? null }));
  const pageUrl = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && key !== "page") params.set(key, value);
    params.set("page", String(page));
    return `?${params}`;
  };
  return <><AdminPageHeading title="Товари" description={`Керування каталогом. Поріг низького залишку: ${threshold}.`} action={<Link href="/admin/products/new" className="rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">Новий товар</Link>} />
    <StockThresholdForm threshold={threshold} />
    <form className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input className={control} name="q" defaultValue={f.q} placeholder="Назва, SKU або slug" aria-label="Пошук товарів" />
      <select className={control} name="category" defaultValue={f.category} aria-label="Категорія"><option value="">Усі категорії</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className={control} name="status" defaultValue={f.status} aria-label="Статус"><option value="">Усі статуси</option><option value="active">Активні</option><option value="inactive">Неактивні</option></select>
      <select className={control} name="stock" defaultValue={f.stock} aria-label="Залишок"><option value="">Усі залишки</option><option value="out">Немає</option><option value="low">Низький</option><option value="in">Достатній</option></select>
      <input className={control} name="min" type="number" step="0.01" min="0" defaultValue={f.min} placeholder="Ціна від" aria-label="Ціна від" />
      <input className={control} name="max" type="number" step="0.01" min="0" defaultValue={f.max} placeholder="Ціна до" aria-label="Ціна до" />
      <select className={control} name="sort" defaultValue={f.sort} aria-label="Сортування"><option value="newest">Новіші</option><option value="oldest">Старіші</option><option value="name">Назва</option><option value="price_asc">Ціна ↑</option><option value="price_desc">Ціна ↓</option><option value="stock_asc">Залишок ↑</option><option value="stock_desc">Залишок ↓</option></select>
      <button className="min-h-10 rounded-md bg-slate-900 px-4 text-sm text-white">Застосувати</button>
    </form>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><ProductList products={items} threshold={threshold} /><div className="flex flex-wrap justify-between gap-2 border-t p-4 text-sm"><span>Сторінка {f.page}</span><div className="flex gap-4">{f.page > 1 && <Link href={pageUrl(f.page - 1)}>Назад</Link>}{rows.length > 20 && <Link href={pageUrl(f.page + 1)}>Далі</Link>}</div></div></div>
  </>;
}
