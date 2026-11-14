import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderPrivateForm, OrderStatusForm } from "@/components/admin/order-actions";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { statusLabels } from "@/lib/admin/order-validation";
import { createClient } from "@/lib/supabase/server";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const [order, history, details] = await Promise.all([
    db.from("orders").select("*,order_items(*)").eq("id", id).maybeSingle(),
    db.from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("order_admin_details").select("*").eq("order_id", id).maybeSingle(),
  ]);
  if (order.error || history.error || details.error) throw new Error(`Failed to load order: ${order.error?.message ?? history.error?.message ?? details.error?.message}`);
  if (!order.data) notFound();
  const o = order.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin/orders" className="text-sm text-blue-700 underline">Усі замовлення</Link><h1 className="mt-2 text-2xl font-bold">Замовлення #{o.order_number}</h1><p className="text-sm text-slate-500">{new Date(o.created_at).toLocaleString("uk-UA", { timeZone: "UTC" })} UTC · {o.id}</p></div><div className="flex flex-wrap gap-2"><Link className="rounded border bg-white px-4 py-2 text-sm" href={`/admin/orders/${id}/print`}>Друк замовлення</Link><Link className="rounded border bg-white px-4 py-2 text-sm" href={`/admin/orders/${id}/print?packing=1`}>Пакувальний лист</Link></div></div>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Клієнт і доставка</h2><p className="mt-2 break-words">{o.customer_name} · {o.customer_email} · {o.customer_phone}</p><p className="mt-1 break-words">{o.country}, {o.city}, {o.postal_code}, {o.address}{o.apartment ? `, ${o.apartment}` : ""}</p><p className="mt-2 break-words">Примітка клієнта: {o.notes || "—"}</p><p className="mt-2">Статус: {statusLabels[o.status]} · Оплата: {o.payment_status}</p></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Товари на момент замовлення</h2><div className="mt-3 space-y-3">{o.order_items.map((item) => <div key={item.id} className="border-t pt-3"><p className="font-medium break-words">{item.product_name}</p><p className="break-words text-sm text-slate-500">{item.product_description}</p><p className="text-sm">{item.quantity} × {item.unit_price} = {item.subtotal} {o.currency}</p></div>)}</div><p className="mt-4 font-bold">Разом: {o.total_amount} {o.currency}</p></section>
    <div className="grid gap-4 lg:grid-cols-2"><OrderStatusForm id={id} status={o.status} /><OrderPrivateForm id={id} details={details.data} /></div>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Історія статусів</h2>{history.data.length === 0 ? <p className="mt-2 text-sm text-slate-500">Історії немає.</p> : <ol className="mt-2 space-y-3">{history.data.map((h) => <li key={h.id} className="border-t pt-2 text-sm"><p>{h.previous_status ? `${statusLabels[h.previous_status]} → ` : ""}{statusLabels[h.new_status]}</p><p className="text-slate-500">{new Date(h.created_at).toLocaleString("uk-UA", { timeZone: "UTC" })} UTC · {h.changed_by ?? "Система"}</p>{h.note && <p className="break-words">Внутрішня примітка: {h.note}</p>}</li>)}</ol>}</section>
  </div>;
}
