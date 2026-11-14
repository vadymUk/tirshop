import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Users, Package, ShoppingCart, Warehouse } from "lucide-react";
import { z } from "zod";
import { AdminDataTable, AdminFilters, AdminPageHeading, AdminPagination, AdminSearch, AdminStatsCard, EmptyState } from "@/components/admin/admin-ui";
import { getAdminList, getDashboardStats } from "@/lib/admin/data";
import { parseAdminListParams } from "@/lib/admin/list-params";
import { adminLinks } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAdmin } from "@/lib/admin/auth";

const descriptions: Record<string, string> = {
  products: "Каталог товарів та їх залишки.",
  categories: "Категорії каталогу магазину.",
  orders: "Замовлення клієнтів та їх поточні статуси.",
  customers: "Зареєстровані профілі клієнтів.",
  media: "Зображення товарів у сховищі.",
  banners: "Рекламні банери магазину.",
  homepage: "Секції головної сторінки.",
  pages: "Інформаційні сторінки магазину.",
  seo: "Метадані сторінок, збережених у базі.",
  inventory: "Історія змін залишків.",
  activity: "Журнал адміністративних дій.",
};

async function Details({ section, id, edit }: { section: string; id: string; edit: boolean }) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient();
  if (section === "orders" && !edit) {
    const [order, items] = await Promise.all([
      db.from("orders").select("id,order_number,status,payment_status,customer_name,customer_email,customer_phone,address,city,country,postal_code,total_amount,currency,created_at").eq("id", id).maybeSingle(),
      db.from("order_items").select("id,product_name,quantity,subtotal").eq("order_id", id).order("created_at"),
    ]);
    if (order.error || items.error) throw new Error(`Failed to load order: ${order.error?.message ?? items.error?.message}`);
    if (!order.data) notFound();
    const o = order.data;
    return <><AdminPageHeading title={`Замовлення #${o.order_number}`} description={`Статус: ${o.status} · Оплата: ${o.payment_status}`} /><div className="grid gap-4 lg:grid-cols-2"><InfoCard title="Клієнт та доставка" values={[["Ім’я", o.customer_name], ["Email", o.customer_email], ["Телефон", o.customer_phone], ["Адреса", `${o.address}, ${o.city}, ${o.postal_code}, ${o.country}`], ["Разом", `${o.total_amount} ${o.currency}`]]} /><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><h2 className="border-b border-slate-100 p-5 font-semibold">Товари</h2><AdminDataTable columns={["Товар", "Кількість", "Сума"]} rows={(items.data ?? []).map((r) => ({ id: r.id, cells: [r.product_name, String(r.quantity), `${r.subtotal} ${o.currency}`] }))} /></div></div><ReadOnlyNotice /></>;
  }
  if (section === "customers" && !edit) {
    const profile = await db.from("profiles").select("id,full_name,phone,created_at").eq("id", id).maybeSingle();
    if (profile.error) throw new Error(`Failed to load customer: ${profile.error.message}`);
    if (!profile.data) notFound();
    const orders = await db.from("orders").select("id,order_number,status,total_amount,currency").eq("user_id", id).order("created_at", { ascending: false }).limit(20);
    if (orders.error) throw new Error(`Failed to load customer orders: ${orders.error.message}`);
    return <><AdminPageHeading title={profile.data.full_name || "Клієнт без імені"} description="Профіль та останні 20 замовлень." /><div className="space-y-4"><InfoCard title="Профіль" values={[["ID", id], ["Телефон", profile.data.phone ?? "—"]]} /><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><h2 className="border-b border-slate-100 p-5 font-semibold">Останні замовлення</h2><AdminDataTable columns={["Замовлення", "Статус", "Сума"]} rows={(orders.data ?? []).map((r) => ({ id: r.id, href: `/admin/orders/${r.id}`, cells: [`#${r.order_number}`, r.status, `${r.total_amount} ${r.currency}`] }))} /></div></div></>;
  }
  if (section === "products" && edit) {
    const result = await db.from("products").select("id,name,slug,sku,price,currency,stock_quantity,is_active").eq("id", id).maybeSingle();
    if (result.error) throw new Error(`Failed to load product: ${result.error.message}`);
    if (!result.data) notFound();
    const p = result.data;
    return <><AdminPageHeading title={p.name} description="Перегляд товару" /><InfoCard title="Дані товару" values={[["Slug", p.slug], ["Артикул", p.sku ?? "—"], ["Ціна", `${p.price} ${p.currency}`], ["Залишок", String(p.stock_quantity)], ["Активний", p.is_active ? "Так" : "Ні"]]} /><ReadOnlyNotice /></>;
  }
  notFound();
}

function InfoCard({ title, values }: { title: string; values: [string, string][] }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-semibold">{title}</h2><dl className="space-y-3">{values.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 text-sm"><dt className="text-slate-500">{label}</dt><dd className="max-w-full break-all text-right font-medium text-slate-900">{value}</dd></div>)}</dl></section>;
}

function ReadOnlyNotice() {
  return <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Режим перегляду. Редагування та інші операції керування ще не підключені.</p>;
}

export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ section: string[] }>; searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  await requireActiveAdmin();
  const { section: parts } = await params;
  const [section, id, action] = parts;
  if (parts.length === 2 && section === "products" && id === "new") return <><AdminPageHeading title="Новий товар" description="Створення товару" /><ReadOnlyNotice /></>;
  if (parts.length === 2 && (section === "orders" || section === "customers")) return <Details section={section} id={id} edit={false} />;
  if (parts.length === 3 && section === "products" && action === "edit") return <Details section={section} id={id} edit />;
  if (parts.length !== 1) notFound();
  const nav = adminLinks.find((item) => item.href === `/admin/${section}`);
  if (!nav) notFound();

  if (section === "team") return <><AdminPageHeading title={nav.label} description="Адміністратори та їхні права доступу." /><div className="rounded-xl border border-slate-200 bg-white"><EmptyState title="Керування командою ще не підключено" description="Призначення ролей доступне лише через довірене адміністрування бази даних." /></div></>;
  if (section === "analytics") {
    const stats = await getDashboardStats();
    return <><AdminPageHeading title={nav.label} description="Поточні показники магазину за даними Supabase." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStatsCard label="Товари" value={stats.products} icon={Package} /><AdminStatsCard label="Замовлення" value={stats.orders} icon={ShoppingCart} /><AdminStatsCard label="Профілі" value={stats.customers} icon={Users} /><AdminStatsCard label="Малий залишок" value={stats.lowStock} icon={Warehouse} detail="5 одиниць або менше" /></div><div className="mt-5 rounded-xl border border-slate-200 bg-white"><EmptyState title="Детальну аналітику ще не підключено" description="Графіки та показники продажів потребують окремих агрегованих даних." /></div></>;
  }
  if (section === "settings") {
    const db = await createClient();
    const result = await db.rpc("get_admin_site_settings");
    if (result.error) throw new Error(`Failed to load site settings: ${result.error.message}`);
    const s = result.data?.[0];
    return <><AdminPageHeading title={nav.label} description="Поточні налаштування магазину." />{s ? <InfoCard title="Магазин" values={[["Назва", s.store_name], ["Email", s.contact_email ?? "—"], ["Телефон", s.contact_phone ?? "—"], ["Валюта", s.currency], ["Мова", s.default_language], ["Часовий пояс", s.timezone], ["Режим обслуговування", s.maintenance_mode ? "Увімкнено" : "Вимкнено"]]} /> : <div className="rounded-xl border border-slate-200 bg-white"><EmptyState title="Налаштувань не знайдено" /></div>}<ReadOnlyNotice /></>;
  }
  const { page, query } = parseAdminListParams(await searchParams);
  const result = await getAdminList(section, page, query);
  if (!result) notFound();
  return <><AdminPageHeading title={nav.label} description={descriptions[section] ?? ""} action={section === "products" ? <Link href="/admin/products/new" className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">Новий товар</Link> : undefined} /><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{result.searchable && <AdminFilters><AdminSearch query={query} placeholder={section === "orders" || section === "customers" ? "Пошук за ім’ям клієнта..." : section === "homepage" ? "Пошук за ключем..." : section === "media" ? "Пошук за шляхом..." : "Пошук за назвою..."} /></AdminFilters>}<AdminDataTable columns={result.columns} rows={result.rows} /><AdminPagination page={page} hasNext={result.hasNext} query={query} /></div><ReadOnlyNotice /><Link href="/admin/analytics" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"><BarChart3 className="size-4" /> Переглянути показники</Link></>;
}
