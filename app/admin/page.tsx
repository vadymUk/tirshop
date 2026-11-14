import Link from "next/link";
import { AlertCircle, Boxes, CircleDollarSign, FolderTree, Package, ShoppingCart, Users, Warehouse } from "lucide-react";
import { AdminDataTable, AdminPageHeading, AdminStatsCard } from "@/components/admin/admin-ui";
import { OverviewCharts } from "@/components/admin/overview-charts";
import { getDashboardOverview } from "@/lib/admin/overview-data";
import { parseOverviewFilter, periods, type Overview } from "@/lib/admin/overview";
import { createClient } from "@/lib/supabase/server";

const date = (value: string) => new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
const amount = (value: number, currency: string) => `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value)} ${currency}`;

function DateFilter({ filter }: { filter?: { period: string; from?: string; to?: string } }) {
  return <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4" action="/admin">
    <label className="flex min-w-44 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">Період
      <select name="period" defaultValue={filter?.period ?? "custom"} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-slate-900">
        {periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">З дати (для власного)
      <input type="date" name="from" defaultValue={filter?.from} className="h-10 min-w-0 rounded-md border border-slate-200 px-3 text-slate-900" />
    </label>
    <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">До дати включно
      <input type="date" name="to" defaultValue={filter?.to} className="h-10 min-w-0 rounded-md border border-slate-200 px-3 text-slate-900" />
    </label>
    <button className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">Застосувати</button>
  </form>;
}

function MoneyCard({ title, data, field, detail }: { title: string; data: Overview["money"]; field: "order_value" | "paid_revenue" | "pending_value" | "cancelled_value"; detail: string }) {
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><h2 className="text-sm font-medium text-slate-500">{title}</h2><CircleDollarSign className="size-5 shrink-0 text-blue-700" /></div><div className="mt-3 space-y-1 text-xl font-semibold text-slate-950">{data.length ? data.map((row) => <p key={row.currency} className="break-words">{amount(row[field], row.currency)}</p>) : <p>Немає даних</p>}</div><p className="mt-2 text-xs text-slate-500">{detail}</p></section>;
}

function TablePanel({ title, href, columns, rows }: { title: string; href: string; columns: string[]; rows: React.ComponentProps<typeof AdminDataTable>["rows"] }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-5"><h2 className="font-semibold">{title}</h2><Link href={href} className="text-sm font-medium text-blue-700 hover:underline">Переглянути всі</Link></div><AdminDataTable columns={columns} rows={rows} /></section>;
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseOverviewFilter(await searchParams);
  if (!parsed.filter) return <><AdminPageHeading title="Панель керування" description="Огляд стану магазину." /><DateFilter /><p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{parsed.error}</p></>;
  const data = await getDashboardOverview(parsed.filter);
  const db = await createClient();
  const settings = await db.rpc("get_admin_site_settings");
  if (settings.error || !settings.data?.[0]) throw new Error(`Failed to load inventory threshold: ${settings.error?.message ?? "missing settings"}`);
  const threshold = settings.data[0].low_stock_threshold;
  const lowStock = await db.from("products").select("id,name,stock_quantity", { count: "exact" })
    .eq("is_active", true).lte("stock_quantity", threshold).order("stock_quantity").order("name").order("id").limit(5);
  if (lowStock.error || lowStock.count === null) throw new Error(`Failed to load low stock alerts: ${lowStock.error?.message ?? "missing count"}`);
  return <>
    <AdminPageHeading title="Панель керування" description={`Період: ${data.from} — ${data.to} включно (UTC).`} />
    <DateFilter filter={parsed.filter} />
    <p className="mb-4 text-sm text-slate-500">Каталог і клієнти — поточний стан; замовлення та фінанси — за датою створення у вибраному періоді.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStatsCard label="Усього товарів" value={data.products} icon={Package} />
      <AdminStatsCard label="Активні товари" value={data.active_products} icon={Package} />
      <AdminStatsCard label="Немає в наявності" value={data.out_of_stock} icon={Warehouse} detail="Усі товари із залишком 0" />
      <AdminStatsCard label="Попередження про залишок" value={lowStock.count} icon={AlertCircle} detail={`Активні товари із залишком до ${threshold}, включно з нульовим`} />
      <AdminStatsCard label="Категорії" value={data.categories} icon={FolderTree} />
      <AdminStatsCard label="Усі замовлення" value={data.orders} icon={ShoppingCart} />
      <AdminStatsCard label="Очікують обробки" value={data.pending_orders} icon={ShoppingCart} detail="Статус замовлення pending" />
      <AdminStatsCard label="Завершені замовлення" value={data.completed_orders} icon={Boxes} detail="Статус completed, незалежно від оплати" />
      <AdminStatsCard label="Зареєстровані клієнти" value={data.customers} icon={Users} detail="Профілі з роллю customer" />
      <AdminStatsCard label="Скасовані замовлення" value={data.cancelled_orders} icon={AlertCircle} />
      <MoneyCard title="Вартість замовлень" data={data.money} field="order_value" detail="Усі замовлення, включно зі скасованими" />
      <MoneyCard title="Оплачена виручка" data={data.money} field="paid_revenue" detail="Оплачено, не скасовано" />
      <MoneyCard title="Очікується оплата" data={data.money} field="pending_value" detail="Оплата pending, не скасовано" />
      <MoneyCard title="Скасована вартість" data={data.money} field="cancelled_value" detail="Усі скасовані, незалежно від оплати" />
    </div>
    <div className="mt-8"><h2 className="mb-4 text-lg font-semibold">Аналітика за період</h2><OverviewCharts data={data} /></div>
    <div className="mt-8"><h2 className="mb-1 text-lg font-semibold">Останні зміни</h2><p className="mb-4 text-sm text-slate-500">Поточні дані незалежно від фільтра дат; до 5 записів у кожному списку.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <TablePanel title="Останні замовлення" href="/admin/orders" columns={["Замовлення", "Клієнт", "Статус", "Оплата", "Сума"]} rows={data.recent_orders.map((r) => ({ id: r.id, href: `/admin/orders/${r.id}`, cells: [`#${r.order_number}`, r.customer_name, r.status, r.payment_status, amount(r.total_amount, r.currency)] }))} />
        <TablePanel title="Нові клієнти" href="/admin/customers" columns={["Клієнт", "Телефон", "Дата"]} rows={data.recent_customers.map((r) => ({ id: r.id, href: `/admin/customers/${r.id}`, cells: [r.full_name || "Без імені", r.phone ?? "—", date(r.created_at)] }))} />
        <TablePanel title="Малий залишок" href="/admin/inventory" columns={["Товар", "Залишок"]} rows={(lowStock.data ?? []).map((r) => ({ id: r.id, href: `/admin/inventory/${r.id}`, cells: [r.name, String(r.stock_quantity)] }))} />
        <TablePanel title="Нещодавно змінені товари" href="/admin/products" columns={["Товар", "Змінено"]} rows={data.recent_products.map((r) => ({ id: r.id, href: `/admin/products/${r.id}/edit`, cells: [r.name, date(r.updated_at)] }))} />
        <TablePanel title="Останні дії адміністраторів" href="/admin/activity" columns={["Дія", "Об’єкт", "Адміністратор", "Дата"]} rows={data.recent_activity.map((r) => ({ id: r.id, cells: [r.action, r.entity_type, r.admin_user_id ?? "—", date(r.created_at)] }))} />
      </div>
    </div>
  </>;
}
