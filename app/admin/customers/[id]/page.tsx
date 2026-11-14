import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { customerDate, parseCustomerFilters, type CustomerParams } from "@/lib/admin/customer-filters";
import { formatCustomerTotals, getCustomerOrders, getCustomers } from "@/lib/admin/customers";
import { statusLabels } from "@/lib/admin/order-validation";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<CustomerParams> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const page = parseCustomerFilters(await searchParams).page;
  const result = await getCustomers(parseCustomerFilters({}), id);
  const customer = result.customers[0];
  if (!customer) notFound();
  const { orders, hasNext } = await getCustomerOrders(id, page);
  return <div className="space-y-4">
    <div><Link href="/admin/customers" className="text-sm text-blue-700 underline">Усі клієнти</Link><h1 className="mt-2 text-2xl font-bold break-words">{customer.full_name || "Без імені"}</h1></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Профіль і контакти</h2>
        <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">Email</dt><dd className="break-all">{customer.email ?? "—"}</dd></div><div><dt className="text-slate-500">Телефон</dt><dd className="break-words">{customer.phone ?? "—"}</dd></div><div><dt className="text-slate-500">Стан</dt><dd>{customer.status}</dd></div><div><dt className="text-slate-500">ID</dt><dd className="break-all">{customer.id}</dd></div></dl>
      </section>
      <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Реєстрація та замовлення</h2>
        <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">Дата реєстрації (UTC)</dt><dd>{customerDate(customer.registeredAt)}</dd></div><div><dt className="text-slate-500">Усього замовлень</dt><dd>{customer.order_count}</dd></div><div><dt className="text-slate-500">Сума замовлень</dt><dd>{formatCustomerTotals(customer.totals)}</dd></div><div><dt className="text-slate-500">Останнє замовлення (UTC)</dt><dd>{customer.latest_order ? customerDate(customer.latest_order) : "—"}</dd></div></dl>
      </section>
    </div>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Історія замовлень і адреси доставки</h2>
      {!orders.length && <p className="mt-3 text-sm text-slate-500">Замовлень на цій сторінці немає.</p>}
      <div className="mt-3 space-y-3">{orders.map((order) => <article key={order.id} className="border-t pt-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><Link href={`/admin/orders/${order.id}`} className="font-semibold text-blue-700 underline">Замовлення #{order.order_number}</Link><span>{customerDate(order.created_at)} UTC</span></div>
        <p className="mt-2">{statusLabels[order.status]} · {order.total_amount} {order.currency}</p>
        <p className="mt-2 break-words">{order.customer_name} · {order.customer_email} · {order.customer_phone}</p>
        <p className="mt-1 break-words">{order.country}, {order.city}, {order.postal_code}, {order.address}{order.apartment ? `, ${order.apartment}` : ""}</p>
      </article>)}</div>
      <div className="mt-4 flex justify-between text-sm"><span>Сторінка {page}</span><div className="flex gap-4">{page > 1 && <Link href={`?page=${page - 1}`}>Назад</Link>}{hasNext && <Link href={`?page=${page + 1}`}>Далі</Link>}</div></div>
    </section>
  </div>;
}
