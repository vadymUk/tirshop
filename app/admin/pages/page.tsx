import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { listPageEditor } from "@/lib/pages/data";
import { pageHref } from "@/lib/pages/schema";

export default async function PagesAdminPage() {
  const pages = await listPageEditor();
  return <>
    <AdminPageHeading title="Інформаційні сторінки" description="Керуйте чернетками, публікацією та SEO сторінок магазину." />
    <Link href="/admin/pages/new" className="mb-4 inline-block rounded bg-slate-900 px-4 py-2 text-white">Створити сторінку</Link>
    <div className="space-y-3">{pages.map((page) => <article key={page.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div><h2 className="font-semibold">{page.document.title}</h2><p className="break-all text-sm text-slate-600">{pageHref(page.document.slug)} · {page.published ? "Опубліковано або заплановано" : "Не опубліковано"}</p></div>
      <Link href={`/admin/pages/${page.id}`} className="rounded border px-3 py-2 text-sm">Редагувати</Link>
    </article>)}</div>
    {!pages.length && <p>Сторінок ще немає. Створіть сторінки about, contact, shipping, returns, privacy та terms для відповідних адрес.</p>}
  </>;
}
