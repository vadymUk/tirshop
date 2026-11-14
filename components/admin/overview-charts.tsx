import { EmptyState } from "@/components/admin/admin-ui";
import type { Overview } from "@/lib/admin/overview";

const formatNumber = (n: number) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(n);

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p><div className="mt-5">{children}</div></section>;
}

function Timeline({ from, to, values, unit }: { from: string; to: string; values: { day: string; value: number }[]; unit: string }) {
  if (!values.length) return <EmptyState title="Немає даних за період" />;
  const map = new Map(values.map((item) => [item.day, item.value]));
  const start = Date.parse(`${from}T00:00:00Z`);
  const count = (Date.parse(`${to}T00:00:00Z`) - start) / 86_400_000 + 1;
  const points = Array.from({ length: count }, (_, index) => {
    const day = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return map.get(day) ?? 0;
  });
  const max = Math.max(...points);
  const scale = max || 1;
  const coordinates = points.map((value, i) => `${points.length === 1 ? 300 : (i / (points.length - 1)) * 600},${150 - value / scale * 140}`).join(" ");
  return <div><p className="text-xs text-slate-500">Максимум за день: {formatNumber(max)} {unit}</p><svg viewBox="0 0 600 160" preserveAspectRatio="none" className="mt-3 h-40 w-full overflow-visible" role="img" aria-label={`Графік за період ${from} – ${to}, максимум ${formatNumber(max)} ${unit}`}><path d="M 0 150 H 600" stroke="#cbd5e1" fill="none" /><polyline points={coordinates} fill="none" stroke="#2563eb" strokeWidth="3" vectorEffect="non-scaling-stroke" />{points.length === 1 && <circle cx="300" cy={150 - points[0] / scale * 140} r="4" fill="#2563eb" />}</svg><div className="mt-2 flex justify-between gap-2 text-xs text-slate-500"><span>{from}</span><span>{to}</span></div><details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer">Значення за днями</summary><ul className="mt-2 max-h-40 overflow-auto">{values.map((v) => <li key={v.day}>{v.day}: {formatNumber(v.value)} {unit}</li>)}</ul></details></div>;
}

function Bars({ rows }: { rows: { label: string; value: number; detail: string }[] }) {
  if (!rows.length) return <EmptyState title="Немає даних за період" />;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <ul className="space-y-4">{rows.map((row, i) => <li key={`${row.label}-${i}`}><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-words font-medium text-slate-700">{row.label}</span><span className="text-slate-500">{row.detail}</span></div><div className="mt-1.5 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${row.value / max * 100}%` }} /></div></li>)}</ul>;
}

export function OverviewCharts({ data }: { data: Overview }) {
  const currencies = Array.from(new Set(data.daily_revenue.map((row) => row.currency)));
  return <div className="grid gap-4 lg:grid-cols-2">
    <ChartPanel title="Замовлення за днями" description="Усі замовлення за датою створення, UTC"><Timeline from={data.from} to={data.to} values={data.daily_orders.map((v) => ({ day: v.day, value: v.count }))} unit="зам." /></ChartPanel>
    <ChartPanel title="Оплачена виручка за днями" description="За датою створення замовлення; валюти не сумуються">{currencies.length ? <div className="space-y-6">{currencies.map((currency) => <div key={currency}><p className="font-medium text-slate-700">{currency}</p><Timeline from={data.from} to={data.to} values={data.daily_revenue.filter((row) => row.currency === currency).map((row) => ({ day: row.day, value: row.amount }))} unit={currency} /></div>)}</div> : <EmptyState title="Немає оплачених замовлень" />}</ChartPanel>
    <ChartPanel title="Замовлення за статусом" description="Поточний статус замовлень за вибраний період"><Bars rows={data.statuses.map((row) => ({ label: row.status, value: row.count, detail: String(row.count) }))} /></ChartPanel>
    <ChartPanel title="Найпродаваніші товари" description="Топ-10 за кількістю в оплачених, нескасованих замовленнях; окремо за валютою"><Bars rows={data.top_products.map((row) => ({ label: row.product_name, value: row.quantity, detail: `${formatNumber(row.quantity)} шт. · ${formatNumber(row.revenue)} ${row.currency}` }))} /></ChartPanel>
    <ChartPanel title="Найкращі категорії" description="Топ-10 за кількістю проданих одиниць; суми за валютою"><Bars rows={data.top_categories.map((row) => ({ label: `${row.name} · ${row.currency}`, value: row.quantity, detail: `${formatNumber(row.quantity)} шт. · ${formatNumber(row.revenue)} ${row.currency}` }))} /></ChartPanel>
  </div>;
}
