import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintButton } from "@/components/admin/order-actions";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { statusLabels } from "@/lib/admin/order-validation";
import { createClient } from "@/lib/supabase/server";

export default async function OrderPrintPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ packing?: string }>;
}) {
  await requireActiveAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const packing = (await searchParams).packing === "1";
  const { data: o, error } = await (await createClient()).from("orders").select("*,order_items(*)").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load print document: ${error.message}`);
  if (!o) notFound();
  return <article className="mx-auto max-w-3xl space-y-5 rounded-xl bg-white p-6 text-slate-950 print:max-w-none print:p-0">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xl font-bold">TIR Shop</p><h1 className="mt-4 text-2xl font-bold">{packing ? "Пакувальний лист" : "Замовлення"} #{o.order_number}</h1><p>{new Date(o.created_at).toLocaleString("uk-UA", { timeZone: "UTC" })} UTC</p></div><PrintButton /></div>
    <section><h2 className="font-semibold">Одержувач</h2><p>{o.customer_name}</p><p>{o.customer_email} · {o.customer_phone}</p><p>{o.country}, {o.city}, {o.postal_code}</p><p>{o.address}{o.apartment ? `, ${o.apartment}` : ""}</p>{o.notes && <p>Примітка клієнта: {o.notes}</p>}</section>
    <section><h2 className="font-semibold">Склад замовлення</h2><table className="mt-3 w-full border-collapse text-left text-sm"><thead><tr className="border-b"><th className="py-2">Товар</th><th className="py-2">Кількість</th>{!packing && <><th className="py-2">Ціна</th><th className="py-2">Сума</th></>}</tr></thead><tbody>{o.order_items.map((item) => <tr key={item.id} className="border-b"><td className="py-2">{item.product_name}<br /><span className="text-slate-600">{item.product_description}</span></td><td>{item.quantity}</td>{!packing && <><td>{item.unit_price} {o.currency}</td><td>{item.subtotal} {o.currency}</td></>}</tr>)}</tbody></table></section>
    {!packing && <section><p className="font-bold">Разом: {o.total_amount} {o.currency}</p><p>Статус: {statusLabels[o.status]} · Оплата: {o.payment_status}</p><p className="mt-2 text-sm text-slate-500">Цей документ є підтвердженням замовлення, а не податковим рахунком.</p></section>}
  </article>;
}
