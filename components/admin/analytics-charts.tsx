import { EmptyState } from "@/components/admin/admin-ui";
import { reportPageSize, type Analytics } from "@/lib/admin/analytics";

const number = (value: number) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value);

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">{title}</h3><div className="mt-4">{children}</div></section>;
}

function Timeline({ rows, field, unit }: { rows: Analytics["timeline"]; field: "orders" | "revenue"; unit: string }) {
  if (!rows.length) return <EmptyState title="Немає даних" />;
  const max = Math.max(...rows.map((row) => row[field]));
  const scale = max || 1;
  const points = rows.map((row, i) => `${rows.length === 1 ? 300 : i * 600 / (rows.length - 1)},${150 - row[field] / scale * 140}`).join(" ");
  return <div><svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label={`Графік, максимум ${number(max)} ${unit}`} className="h-40 w-full">
    <path d="M 0 150 H 600" stroke="#cbd5e1" fill="none" /><polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    {rows.length === 1 && <circle cx="300" cy={150 - rows[0][field] / scale * 140} r="4" fill="#2563eb" />}
  </svg><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{rows[0].bucket}</span><span>{rows[rows.length - 1].bucket}</span></div>
    <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer">Значення графіка</summary><ul className="mt-2 max-h-48 overflow-auto">{rows.map((row) => <li key={row.bucket}>{row.bucket}: {number(row[field])} {unit}</li>)}</ul></details>
  </div>;
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length) return <EmptyState title="Немає даних" />;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <ul className="space-y-3">{rows.map((row, i) => <li key={`${row.label}-${i}`}><div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{row.label}</span><span>{number(row.value)}</span></div><div className="mt-1 h-2 rounded bg-slate-100"><div className="h-full rounded bg-blue-600" style={{ width: `${row.value / max * 100}%` }} /></div></li>)}</ul>;
}

export function AnalyticsCharts({ data }: { data: Analytics }) {
  return <div className="grid gap-4 lg:grid-cols-2">
    <Panel title={`Оплачена виручка · ${data.currency}`}><Timeline rows={data.timeline} field="revenue" unit={data.currency} /></Panel>
    <Panel title="Кількість замовлень"><Timeline rows={data.timeline} field="orders" unit="зам." /></Panel>
    <Panel title="Статуси замовлень"><Bars rows={data.statuses.map((row) => ({ label: row.status, value: row.count }))} /></Panel>
    <Panel title="Продажі товарів · кількість"><Bars rows={data.best_products.slice(0, reportPageSize).map((row) => ({ label: row.name, value: row.quantity }))} /></Panel>
    <Panel title="Продажі категорій · кількість"><Bars rows={data.categories.slice(0, reportPageSize).map((row) => ({ label: row.name, value: row.quantity }))} /></Panel>
  </div>;
}
