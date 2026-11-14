import { z } from "zod";
import { validDate } from "@/lib/admin/overview";

export const analyticsPeriods = [
  ["today", "Сьогодні"],
  ["last_7_days", "Останні 7 днів"],
  ["last_30_days", "Останні 30 днів"],
  ["last_90_days", "Останні 90 днів"],
  ["this_year", "Цей рік"],
  ["custom", "Власний період"],
] as const;
export const analyticsBuckets = [["day", "День"], ["week", "Тиждень"], ["month", "Місяць"]] as const;

export type AnalyticsFilter = {
  period: (typeof analyticsPeriods)[number][0];
  bucket: (typeof analyticsBuckets)[number][0];
  currency?: string;
  from?: string;
  to?: string;
};

export function parseAnalyticsFilter(params: Record<string, string | string[] | undefined>): { filter?: AnalyticsFilter; error?: string } {
  const period = params.period ?? "last_30_days";
  const bucket = params.bucket ?? "day";
  const currency = params.currency || undefined;
  if (typeof period !== "string" || !analyticsPeriods.some(([value]) => value === period)) return { error: "Невідомий період." };
  if (typeof bucket !== "string" || !analyticsBuckets.some(([value]) => value === bucket)) return { error: "Невідомий інтервал графіка." };
  if (currency !== undefined && (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency))) return { error: "Валюта має складатися з трьох великих латинських літер." };
  const filter: AnalyticsFilter = { period: period as AnalyticsFilter["period"], bucket: bucket as AnalyticsFilter["bucket"], currency };
  if (period === "custom") {
    const { from, to } = params;
    if (typeof from !== "string" || typeof to !== "string" || !validDate(from) || !validDate(to) || from > to) return { error: "Вкажіть коректні дати початку та завершення." };
    if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > 730) return { error: "Максимальна тривалість періоду — 731 день." };
    filter.from = from;
    filter.to = to;
  }
  return { filter };
}

const product = z.object({ product_id: z.string().nullable(), name: z.string(), quantity: z.number(), revenue: z.number() });
const stock = z.object({ id: z.string(), name: z.string(), stock_quantity: z.number() });
export const analyticsSchema = z.object({
  from: z.string(), to: z.string(), currency: z.string(), bucket: z.enum(["day", "week", "month"]), threshold: z.number(),
  orders: z.number(), completed: z.number(), cancelled: z.number(), gross: z.number(), paid: z.number(), unpaid: z.number(), average: z.number(),
  customers: z.number(), new_customers: z.number(), repeat_customers: z.number(),
  timeline: z.array(z.object({ bucket: z.string(), orders: z.number(), revenue: z.number() })),
  statuses: z.array(z.object({ status: z.string(), count: z.number() })),
  best_products: z.array(product),
  revenue_products: z.array(product),
  least_products: z.array(z.object({ id: z.string(), name: z.string(), quantity: z.number(), revenue: z.number() })),
  categories: z.array(z.object({ category_id: z.string().nullable(), name: z.string(), quantity: z.number(), revenue: z.number(), orders: z.number() })),
  top_customers: z.array(z.object({ id: z.string(), name: z.string(), orders: z.number(), revenue: z.number() })),
  low_stock: z.array(stock), out_of_stock: z.array(stock),
});
export type Analytics = z.infer<typeof analyticsSchema>;

export const reportPageSize = 20;
export function hasMoreAnalytics(data: Analytics) {
  return [data.best_products, data.revenue_products, data.least_products, data.categories,
    data.top_customers, data.low_stock, data.out_of_stock].some((rows) => rows.length > reportPageSize);
}

export function analyticsCsv(data: Analytics, firstPage = true): string {
  const rows: (string | number)[][] = firstPage ? [
    ["report", "entity_id", "name", "quantity", "orders", "amount", "currency", "from_utc", "to_utc"],
  ] : [];
  const add = (report: string, name: string, quantity: string | number = "", orders: string | number = "", amount: string | number = "", currency = "", id = "") =>
    rows.push([report, id, name, quantity, orders, amount, currency, data.from, data.to]);
  if (firstPage) {
  for (const [label, value] of [
    ["orders", data.orders], ["completed_orders", data.completed], ["cancelled_orders", data.cancelled],
    ["customers_total", data.customers], ["new_customers", data.new_customers], ["repeat_customers", data.repeat_customers],
  ] as const) add("summary", label, value);
  for (const [label, value] of [["gross", data.gross], ["paid", data.paid], ["unpaid", data.unpaid], ["average", data.average]] as const) add("summary", label, "", "", value, data.currency);
  for (const row of data.timeline) add(`timeline_${data.bucket}`, row.bucket, "", row.orders, row.revenue, data.currency);
  for (const row of data.statuses) add("status", row.status, "", row.count);
  }
  for (const [report, products] of [["best_products", data.best_products], ["revenue_products", data.revenue_products], ["least_products", data.least_products]] as const) {
    for (const row of products.slice(0, reportPageSize)) add(report, row.name, row.quantity, "", row.revenue, data.currency, "product_id" in row ? row.product_id ?? "" : row.id);
  }
  for (const row of data.categories.slice(0, reportPageSize)) add("categories", row.name, row.quantity, row.orders, row.revenue, data.currency, row.category_id ?? "");
  for (const row of data.top_customers.slice(0, reportPageSize)) add("top_customers", row.name, "", row.orders, row.revenue, data.currency, row.id);
  for (const [report, products] of [["low_stock", data.low_stock], ["out_of_stock", data.out_of_stock]] as const) {
    for (const row of products.slice(0, reportPageSize)) add(report, row.name, row.stock_quantity, "", "", "", row.id);
  }
  const content = rows.map((row) => row.map((value) => {
    const text = String(value);
    const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  return (firstPage ? "\uFEFF" : "") + (content ? `${content}\r\n` : "");
}
