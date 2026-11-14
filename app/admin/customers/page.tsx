import Link from "next/link";
import { AdminDataTable, AdminPageHeading } from "@/components/admin/admin-ui";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { customerDate, parseCustomerFilters, type CustomerParams } from "@/lib/admin/customer-filters";
import { formatCustomerTotals, getCustomers } from "@/lib/admin/customers";

const field = "min-h-10 min-w-0 rounded border bg-white px-3 text-sm";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<CustomerParams> }) {
  await requireActiveAdmin();
  const raw = await searchParams;
  const filter = parseCustomerFilters(raw);
  const invalid = (filter.from && filter.to && filter.from > filter.to) ||
    (filter.min !== null && filter.max !== null && filter.min > filter.max);
  const result = invalid ? null : await getCustomers(filter);
  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && key !== "page") params.set(key, value);
    params.set("page", String(page));
    return `?${params}`;
  };
  return <>
    <AdminPageHeading title="Клієнти" description="Профілі клієнтів та історія їхніх замовлень." />
    <form className="mb-4 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Ім’я або телефон<input className={`${field} w-full`} name="q" defaultValue={filter.query} /></label>
      <label className="text-sm">Реєстрація від (UTC)<input className={`${field} w-full`} type="date" name="from" defaultValue={filter.from} /></label>
      <label className="text-sm">Реєстрація до (UTC)<input className={`${field} w-full`} type="date" name="to" defaultValue={filter.to} /></label>
      <label className="text-sm">Порядок реєстрації<select className={`${field} w-full`} name="sort" defaultValue={filter.ascending ? "asc" : "desc"}><option value="desc">Спочатку нові</option><option value="asc">Спочатку давні</option></select></label>
      <label className="text-sm">Замовлень від<input className={`${field} w-full`} type="number" min="0" max="99999999" name="min" defaultValue={filter.min ?? ""} /></label>
      <label className="text-sm">Замовлень до<input className={`${field} w-full`} type="number" min="0" max="99999999" name="max" defaultValue={filter.max ?? ""} /></label>
      <button className="min-h-10 self-end rounded bg-slate-900 px-4 text-sm text-white">Застосувати</button>
    </form>
    {invalid ? <p role="alert" className="rounded border border-red-200 bg-white p-4 text-red-700">Початок діапазону не може бути більшим за кінець.</p> : result && <div className="rounded-xl border bg-white">
      <AdminDataTable columns={["Клієнт", "Email", "Телефон", "Реєстрація", "Замовлень", "Сума замовлень", "Останнє замовлення", "Стан"]}
        rows={result.customers.map((customer) => ({ id: customer.id, href: `/admin/customers/${customer.id}`, cells: [
          customer.full_name || "Без імені", customer.email ?? "—", customer.phone ?? "—", customerDate(customer.registeredAt),
          String(customer.order_count), formatCustomerTotals(customer.totals), customer.latest_order ? customerDate(customer.latest_order) : "—", customer.status,
        ] }))} />
      <div className="flex justify-between gap-4 border-t p-4 text-sm"><span>Сторінка {filter.page}</span><div className="flex gap-4">
        {filter.page > 1 && <Link href={href(filter.page - 1)}>Назад</Link>}{result.hasNext && <Link href={href(filter.page + 1)}>Далі</Link>}
      </div></div>
    </div>}
  </>;
}
