import { z } from "zod";

export const periods = [
  ["today", "Сьогодні"],
  ["yesterday", "Вчора"],
  ["last_7_days", "Останні 7 днів"],
  ["last_30_days", "Останні 30 днів"],
  ["this_month", "Цей місяць"],
  ["this_year", "Цей рік"],
  ["custom", "Власний період"],
] as const;

export type Period = (typeof periods)[number][0];
export type OverviewFilter = { period: Period; from?: string; to?: string };

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "0001-01-01" && value <= "9998-12-31";
}

export function parseOverviewFilter(params: Record<string, string | string[] | undefined>): { filter?: OverviewFilter; error?: string } {
  const raw = params.period ?? "last_30_days";
  if (typeof raw !== "string" || !periods.some(([value]) => value === raw)) return { error: "Невідомий період." };
  const period = raw as Period;
  if (period !== "custom") return { filter: { period } };
  const { from, to } = params;
  if (typeof from !== "string" || typeof to !== "string" || !validDate(from) || !validDate(to) || from > to) {
    return { error: "Вкажіть коректні дати початку та завершення." };
  }
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > 730) return { error: "Максимальна тривалість періоду — 731 день." };
  return { filter: { period, from, to } };
}

const money = z.object({ currency: z.string(), order_value: z.number(), paid_revenue: z.number(), pending_value: z.number(), cancelled_value: z.number() });
const recentOrder = z.object({ id: z.string(), order_number: z.number(), customer_name: z.string(), status: z.string(), payment_status: z.string(), total_amount: z.number(), currency: z.string(), created_at: z.string() });

export const overviewSchema = z.object({
  from: z.string(), to: z.string(),
  products: z.number(), active_products: z.number(), out_of_stock: z.number(), categories: z.number(), customers: z.number(),
  orders: z.number(), pending_orders: z.number(), completed_orders: z.number(), cancelled_orders: z.number(),
  money: z.array(money),
  daily_orders: z.array(z.object({ day: z.string(), count: z.number() })),
  daily_revenue: z.array(z.object({ day: z.string(), currency: z.string(), amount: z.number() })),
  statuses: z.array(z.object({ status: z.string(), count: z.number() })),
  top_products: z.array(z.object({ product_id: z.string().nullable(), product_name: z.string(), quantity: z.number(), currency: z.string(), revenue: z.number() })),
  top_categories: z.array(z.object({ category_id: z.string().nullable(), name: z.string(), currency: z.string(), quantity: z.number(), revenue: z.number() })),
  recent_orders: z.array(recentOrder),
  recent_customers: z.array(z.object({ id: z.string(), full_name: z.string().nullable(), phone: z.string().nullable(), created_at: z.string() })),
  low_stock: z.array(z.object({ id: z.string(), name: z.string(), stock_quantity: z.number() })),
  recent_products: z.array(z.object({ id: z.string(), name: z.string(), updated_at: z.string() })),
  recent_activity: z.array(z.object({ id: z.string(), action: z.string(), entity_type: z.string(), admin_user_id: z.string().nullable(), created_at: z.string() })),
});

export type Overview = z.infer<typeof overviewSchema>;
