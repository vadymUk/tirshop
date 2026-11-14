import Link from "next/link";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { statusLabels, statusSchema } from "@/lib/admin/order-validation";
import { createClient } from "@/lib/supabase/server";

const field = "min-h-10 min-w-0 rounded border bg-white px-3 text-sm";
const dateInput = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveAdmin();
  const raw = await searchParams;
  const get = (name: string) => typeof raw[name] === "string" ? raw[name] as string : "";
  const q = get("q").trim().replace(/[\\,()"*%]/g, " ").slice(0, 100);
  const customer = get("customer").trim().replace(/[\\,()"*%]/g, " ").slice(0, 100);
  const status = statusSchema.safeParse(get("status"));
  const payment = z.enum(["pending", "paid", "failed", "refunded"]).safeParse(get("payment"));
  const from = dateInput(get("from")), to = dateInput(get("to"));
  const number = /^\d{1,15}$/.test(get("number")) ? get("number") : "";
  const page = /^\d{1,5}$/.test(get("page")) ? Math.max(1, Number(get("page"))) : 1;
  const db = await createClient();
  let request = db.from("orders").select("id,order_number,created_at,customer_name,customer_email,customer_phone,total_amount,currency,status,payment_status")
    .order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20);
  if (q) {
    const term = q.replace(/_/g, "\\_");
    const id = z.string().uuid().safeParse(q).success ? `,id.eq.${q}` : "";
    request = request.or(`customer_name.ilike.*${term}*,customer_email.ilike.*${term}*,customer_phone.ilike.*${term}*${id}`);
  }
  if (customer) request = request.ilike("customer_name", `%${customer.replace(/_/g, "\\_")}%`);
  if (number) request = request.eq("order_number", Number(number));
  if (status.success) request = request.eq("status", status.data);
  if (payment.success) request = request.eq("payment_status", payment.data);
  if (from) request = request.gte("created_at", `${from}T00:00:00Z`);
  if (to) {
    const next = new Date(`${to}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    request = request.lt("created_at", next.toISOString());
  }
  const result = await request;
  if (result.error && result.error.code !== "PGRST103") throw new Error(`Failed to load orders: ${result.error.message}`);
  const rows = result.data ?? [];
  const href = (n: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && k !== "page") params.set(k, v);
    params.set("page", String(n)); return `?${params}`;
  };
  return <><AdminPageHeading title="Замовлення" description="Пошук, обробка і контроль замовлень." />
    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input className={field} name="q" defaultValue={q} placeholder="ID, ім’я, email або телефон" aria-label="Пошук" />
      <input className={field} name="customer" defaultValue={customer} placeholder="Ім’я клієнта" aria-label="Клієнт" />
      <input className={field} name="number" defaultValue={number} placeholder="Номер замовлення" aria-label="Номер замовлення" inputMode="numeric" />
      <select className={field} name="status" defaultValue={status.success ? status.data : ""} aria-label="Статус замовлення"><option value="">Усі статуси</option>{Object.entries(statusLabels).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select>
      <select className={field} name="payment" defaultValue={payment.success ? payment.data : ""} aria-label="Статус оплати"><option value="">Усі оплати</option><option value="pending">Очікує оплати</option><option value="paid">Оплачено</option><option value="failed">Помилка оплати</option><option value="refunded">Повернуто</option></select>
      <label className="text-sm">Від (UTC)<input type="date" name="from" defaultValue={from} className={`${field} w-full`} /></label>
      <label className="text-sm">До (UTC)<input type="date" name="to" defaultValue={to} className={`${field} w-full`} /></label>
      <button className="min-h-10 rounded bg-slate-900 px-4 text-sm text-white">Застосувати</button>
    </form>
    {!rows.length && <p className="rounded-xl border bg-white p-8 text-center text-slate-500">Замовлень не знайдено.</p>}
    <div className="space-y-3">{rows.slice(0, 20).map((row) => <Link href={`/admin/orders/${row.id}`} key={row.id} className="block rounded-xl border bg-white p-4 hover:border-blue-400">
      <div className="flex flex-wrap justify-between gap-2"><strong>#{row.order_number}</strong><span>{new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(row.created_at))} UTC</span></div>
      <p className="mt-2 break-words">{row.customer_name} · {row.customer_email} · {row.customer_phone}</p>
      <p className="mt-2 text-sm text-slate-600">{statusLabels[row.status]} · Оплата: {row.payment_status} · {row.total_amount} {row.currency}</p>
    </Link>)}</div>
    <div className="mt-4 flex justify-between text-sm"><span>Сторінка {page}</span><div className="flex gap-4">{page > 1 && <Link href={href(page - 1)}>Назад</Link>}{rows.length > 20 && <Link href={href(page + 1)}>Далі</Link>}</div></div>
  </>;
}
