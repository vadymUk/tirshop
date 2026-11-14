import Link from "next/link";
import { AdminDataTable, AdminPageHeading } from "@/components/admin/admin-ui";
import { activityPageSize, parseActivityFilter } from "@/lib/admin/activity";
import { getActivity } from "@/lib/admin/activity-data";

const control = "min-h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900";
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseActivityFilter(await searchParams);
  if (!parsed.filter) return <><AdminPageHeading title="Журнал дій" description="Журнал адміністративних операцій." /><p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{parsed.error}</p><Link className="mt-4 inline-block text-blue-700 underline" href="/admin/activity">Скинути фільтри</Link></>;
  const filter = parsed.filter;
  const rows = await getActivity(filter, (filter.page - 1) * activityPageSize, activityPageSize + 1);
  const query = new URLSearchParams({ admin: filter.admin, action: filter.action, entity: filter.entity, from: filter.from, to: filter.to, q: filter.query });
  const pageUrl = (page: number) => { const result = new URLSearchParams(query); result.set("page", String(page)); return `?${result}`; };
  const date = (value: string) => new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  return <>
    <AdminPageHeading title="Журнал дій" description="Події доступні активним адміністраторам. Дати й час — UTC." action={<a href={`/admin/activity/export?${query}`} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium">Експортувати CSV</a>} />
    <form className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-medium">ID адміністратора<input name="admin" defaultValue={filter.admin} maxLength={36} placeholder="UUID" className={control} /></label>
      <label className="flex flex-col gap-1 text-sm font-medium">Дія (точно)<input name="action" defaultValue={filter.action} maxLength={100} placeholder="update, publish..." className={control} /></label>
      <label className="flex flex-col gap-1 text-sm font-medium">Тип об’єкта (точно)<input name="entity" defaultValue={filter.entity} maxLength={100} placeholder="products, page..." className={control} /></label>
      <label className="flex flex-col gap-1 text-sm font-medium">Від дати, UTC<input name="from" type="date" defaultValue={filter.from} className={control} /></label>
      <label className="flex flex-col gap-1 text-sm font-medium">До дати включно, UTC<input name="to" type="date" defaultValue={filter.to} className={control} /></label>
      <label className="flex flex-col gap-1 text-sm font-medium">Пошук за дією, типом, ID або описом<input name="q" defaultValue={filter.query} maxLength={100} className={control} /></label>
      <button className="min-h-10 rounded-md bg-slate-900 px-4 text-sm text-white sm:col-span-2 lg:col-span-3">Застосувати</button>
    </form>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><AdminDataTable columns={["Адміністратор", "Дія", "Тип", "ID об’єкта", "Дата UTC", "Опис", "Метадані"]} rows={rows.slice(0, activityPageSize).map((row) => ({ id: row.id, cells: [row.admin_user_id ?? "Невідомо", row.action, row.entity_type, row.entity_id ?? "—", date(row.created_at), row.description ?? "—", JSON.stringify(row.metadata)] }))} /></div>
    <nav aria-label="Сторінки журналу" className="mt-4 flex gap-4 text-sm"><span>Сторінка {filter.page}</span>{filter.page > 1 && <Link href={pageUrl(filter.page - 1)} className="text-blue-700 underline">Назад</Link>}{rows.length > activityPageSize && <Link href={pageUrl(filter.page + 1)} className="text-blue-700 underline">Далі</Link>}</nav>
  </>;
}
