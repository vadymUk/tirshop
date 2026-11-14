import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { MediaLibrary } from "@/components/admin/media-library";
import { listMedia } from "@/lib/admin/media-data";
import { mediaFilters } from "@/lib/admin/media-shared";

const field = "min-h-10 min-w-0 rounded border bg-white px-3 text-sm";

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const filters = mediaFilters(raw);
  const { rows, hasNext } = await listMedia(filters);
  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && key !== "page") params.set(key, value);
    params.set("page", String(page));
    return `?${params}`;
  };
  return <><AdminPageHeading title="Медіатека" description="Публічні зображення товарів та сайту." />
    {filters.product && <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">Виберіть зображення для товару. Буде створено окрему копію. <Link className="text-blue-700 underline" href={`/admin/products/${filters.product}/edit`}>Повернутися до товару</Link></p>}
    <form className="mb-4 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      {filters.product && <input type="hidden" name="product" value={filters.product} />}
      <label className="text-sm">Сховище<select name="bucket" defaultValue={filters.bucket} className={`${field} w-full`}><option value="site-media">Матеріали сайту</option><option value="product-images">Зображення товарів</option></select></label>
      <label className="text-sm">Назва файлу<input name="q" maxLength={100} defaultValue={filters.query} className={`${field} w-full`} /></label>
      <label className="text-sm">Тип файлу<select name="type" defaultValue={filters.type} className={`${field} w-full`}><option value="">Усі типи</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
      <label className="text-sm">Дата завантаження<select name="sort" defaultValue={filters.ascending ? "asc" : "desc"} className={`${field} w-full`}><option value="desc">Спочатку нові</option><option value="asc">Спочатку давні</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="orphan" value="1" defaultChecked={filters.orphan} /> Лише без відомих посилань</label>
      <button className="min-h-10 rounded bg-slate-900 px-4 text-sm text-white">Застосувати</button>
    </form>
    <MediaLibrary bucket={filters.bucket} rows={rows} product={filters.product} />
    <div className="mt-4 flex justify-between text-sm"><span>Сторінка {filters.page}</span><div className="flex gap-4">{filters.page > 1 && <Link href={href(filters.page - 1)}>Назад</Link>}{hasNext && <Link href={href(filters.page + 1)}>Далі</Link>}</div></div>
  </>;
}
