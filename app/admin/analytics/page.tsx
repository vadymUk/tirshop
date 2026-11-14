import { BarChart3 } from "lucide-react";
import { AdminDataTable, AdminPageHeading, AdminStatsCard } from "@/components/admin/admin-ui";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";
import { getEcommerceAnalytics } from "@/lib/admin/analytics-data";
import { analyticsBuckets, analyticsPeriods, hasMoreAnalytics, parseAnalyticsFilter, reportPageSize, type AnalyticsFilter } from "@/lib/admin/analytics";

const number = (value: number) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value);
const money = (value: number, currency: string) => `${number(value)} ${currency}`;

function Filter({ filter, currency }: { filter?: AnalyticsFilter; currency?: string }) {
  return <form action="/admin/analytics" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium">Період<select name="period" defaultValue={filter?.period ?? "custom"} className="h-10 rounded-md border border-slate-200 bg-white px-3">{analyticsPeriods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium">З дати (власний)<input type="date" name="from" defaultValue={filter?.from} className="h-10 min-w-0 rounded-md border border-slate-200 px-3" /></label>
    <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium">До дати включно<input type="date" name="to" defaultValue={filter?.to} className="h-10 min-w-0 rounded-md border border-slate-200 px-3" /></label>
    <label className="flex w-28 flex-col gap-1 text-sm font-medium">Валюта ISO<input name="currency" defaultValue={currency ?? filter?.currency} pattern="[A-Z]{3}" maxLength={3} placeholder="За замовч." className="h-10 rounded-md border border-slate-200 px-3" /></label>
    <label className="flex w-36 flex-col gap-1 text-sm font-medium">Групування<select name="bucket" defaultValue={filter?.bucket ?? "day"} className="h-10 rounded-md border border-slate-200 bg-white px-3">{analyticsBuckets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <button className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">Застосувати</button>
  </form>;
}

function Table({ title, columns, rows }: { title: string; columns: string[]; rows: React.ComponentProps<typeof AdminDataTable>["rows"] }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><h3 className="border-b border-slate-100 p-5 font-semibold">{title}</h3><AdminDataTable columns={columns} rows={rows} /></section>;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const parsed = parseAnalyticsFilter(params);
  if (!parsed.filter) return <><AdminPageHeading title="Аналітика" description="Звіти магазину." /><Filter /><p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{parsed.error}</p></>;
  const rawPage = params.page ?? "1";
  if (typeof rawPage !== "string" || !/^[1-9]\d{0,7}$/.test(rawPage)) return <><AdminPageHeading title="Аналітика" description="Звіти магазину." /><Filter filter={parsed.filter} /><p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">Некоректна сторінка звітів.</p></>;
  const page = Number(rawPage);
  const filter = parsed.filter;
  const data = await getEcommerceAnalytics(filter, (page - 1) * reportPageSize);
  const query = new URLSearchParams({ period: filter.period, bucket: filter.bucket, currency: data.currency });
  if (filter.from && filter.to) { query.set("from", filter.from); query.set("to", filter.to); }
  const pageLink = (target: number) => {
    const result = new URLSearchParams(query);
    result.set("page", String(target));
    return `?${result}`;
  };
  const productRows = (rows: typeof data.best_products) => rows.slice(0, reportPageSize).map((row, i) => ({ id: `${row.product_id ?? row.name}-${i}`, cells: [row.name, number(row.quantity), money(row.revenue, data.currency)] }));
  return <>
    <AdminPageHeading title="Аналітика" description={`Період: ${data.from} — ${data.to} включно (UTC). Валюта: ${data.currency}.`} action={<a href={`/admin/analytics/export?${query}`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">Експортувати звіти CSV</a>} />
    <Filter filter={filter} currency={data.currency} />
    <p className="mb-4 text-sm text-slate-600">Замовлення відбираються за датою створення та обраною валютою. Стани оплати й замовлень — поточні. Зареєстровані та нові клієнти не залежать від валюти.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {([
        ["Вартість замовлень", money(data.gross, data.currency), "Без скасованих; включає неоплачені та повернені"],
        ["Оплачена виручка", money(data.paid, data.currency), "Оплачені й нескасовані"],
        ["Неоплачена вартість", money(data.unpaid, data.currency), "Очікування або помилка оплати; без скасованих"],
        ["Середнє замовлення", money(data.average, data.currency), "Вартість нескасованих / їх кількість"],
        ["Усі замовлення", data.orders, "Включно зі скасованими"],
        ["Завершені", data.completed, "Поточний статус completed"],
        ["Скасовані", data.cancelled, "Поточний статус cancelled"],
        ["Усі клієнти", data.customers, "Поточна кількість профілів клієнтів"],
        ["Нові клієнти", data.new_customers, "Профілі, створені за період"],
        ["Повторні клієнти", data.repeat_customers, "Щонайменше два нескасовані замовлення за період"],
      ] as const).map(([label, value, detail]) => <AdminStatsCard key={label} label={label} value={value} detail={detail} icon={BarChart3} />)}
    </div>
    <h2 className="mb-4 mt-8 text-lg font-semibold">Графіки</h2><AnalyticsCharts data={data} />
    <h2 className="mb-2 mt-8 text-lg font-semibold">Звіти</h2>
    <p className="mb-4 text-sm text-slate-600">Списки і відповідні графіки показують по 20 позицій на спільній сторінці; CSV містить усі сторінки. Продажі товарів і категорій — лише оплачені нескасовані замовлення. Категорія визначається за поточним товаром, а не на момент покупки.</p>
    <div className="grid gap-4 xl:grid-cols-2">
      <Table title="Найпродаваніші товари" columns={["Товар", "Кількість", "Оплачено"]} rows={productRows(data.best_products)} />
      <Table title="Найвища виручка від товарів" columns={["Товар", "Кількість", "Оплачено"]} rows={productRows(data.revenue_products)} />
      <Table title="Найменше продані активні товари" columns={["Товар", "Кількість", "Оплачено"]} rows={data.least_products.slice(0, reportPageSize).map((row) => ({ id: row.id, cells: [row.name, number(row.quantity), money(row.revenue, data.currency)] }))} />
      <Table title="Категорії" columns={["Категорія", "Кількість", "Замовлення", "Оплачено"]} rows={data.categories.slice(0, reportPageSize).map((row, i) => ({ id: row.category_id ?? `unknown-${i}`, cells: [row.name, number(row.quantity), number(row.orders), money(row.revenue, data.currency)] }))} />
      <Table title="Клієнти з найбільшою вартістю замовлень" columns={["Клієнт", "Замовлення", "Вартість без скасованих"]} rows={data.top_customers.slice(0, reportPageSize).map((row) => ({ id: row.id, cells: [row.name, number(row.orders), money(row.revenue, data.currency)] }))} />
      <Table title={`Малий залишок (1–${data.threshold})`} columns={["Товар", "Залишок"]} rows={data.low_stock.slice(0, reportPageSize).map((row) => ({ id: row.id, cells: [row.name, number(row.stock_quantity)] }))} />
      <Table title="Немає в наявності" columns={["Товар", "Залишок"]} rows={data.out_of_stock.slice(0, reportPageSize).map((row) => ({ id: row.id, cells: [row.name, number(row.stock_quantity)] }))} />
    </div>
    <nav aria-label="Сторінки звітів" className="mt-4 flex flex-wrap items-center gap-3 text-sm"><span>Сторінка {page}</span>{page > 1 && <a className="rounded border border-slate-300 bg-white px-4 py-2" href={pageLink(page - 1)}>Назад</a>}{hasMoreAnalytics(data) && <a className="rounded border border-slate-300 bg-white px-4 py-2" href={pageLink(page + 1)}>Далі</a>}</nav>
  </>;
}
