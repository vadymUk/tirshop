import "server-only";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { parseCustomerFilters } from "@/lib/admin/customer-filters";

const totalsSchema = z.array(z.object({ currency: z.string(), amount: z.number() }));
type Filters = ReturnType<typeof parseCustomerFilters>;

export async function getCustomers(filters: Filters, id?: string) {
  await requireActiveAdmin();
  const db = await createClient();
  const result = await db.rpc("admin_customers", {
    p_query: filters.query, p_from: filters.from || null, p_to: filters.to || null,
    p_min_orders: filters.min, p_max_orders: filters.max, p_ascending: filters.ascending,
    p_offset: id ? 0 : (filters.page - 1) * 20, p_id: id ?? null,
  });
  if (result.error) throw new Error(`Failed to load customers: ${result.error.message}`);
  const hasNext = result.data.length > 20;
  const admin = createAdminClient();
  const customers = await Promise.all(result.data.slice(0, 20).map(async (profile) => {
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error || !data.user) throw new Error(`Failed to load customer account: ${error?.message ?? "missing user"}`);
    const user = data.user;
    const banned = user.banned_until != null && new Date(user.banned_until).getTime() > Date.now();
    const status = !profile.is_active ? "Неактивний профіль" : banned ? "Заблокований" : !user.email_confirmed_at && user.email ? "Email не підтверджено" : "Активний";
    return { ...profile, totals: totalsSchema.parse(profile.totals), email: user.email ?? null,
      registeredAt: user.created_at, status };
  }));
  return { customers, hasNext };
}

export async function getCustomerOrders(id: string, page: number) {
  await requireActiveAdmin();
  const db = await createClient();
  const result = await db.from("orders")
    .select("id,order_number,created_at,status,payment_status,total_amount,currency,customer_name,customer_email,customer_phone,country,city,postal_code,address,apartment")
    .eq("user_id", id).order("created_at", { ascending: false }).order("id")
    .range((page - 1) * 20, page * 20);
  if (result.error && result.error.code !== "PGRST103") throw new Error(`Failed to load customer orders: ${result.error.message}`);
  const rows = result.data ?? [];
  return { orders: rows.slice(0, 20), hasNext: rows.length > 20 };
}

export function formatCustomerTotals(totals: { currency: string; amount: number }[]) {
  return totals.length ? totals.map((total) => `${total.amount.toFixed(2)} ${total.currency}`).join(" · ") : "—";
}
