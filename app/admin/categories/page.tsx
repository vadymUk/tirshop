import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { CategoryManager } from "@/components/admin/category-manager";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { getProductImageOriginalUrl } from "@/lib/storage/urls";
import { publicEnv } from "@/lib/env";

function categoryImageUrl(value: string | null) {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return getProductImageOriginalUrl(value);
  try {
    const url = new URL(value);
    return url.origin === new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin ? url.href : null;
  } catch {
    return null;
  }
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireActiveAdmin();
  const raw = await searchParams;
  const query = typeof raw.q === "string" ? raw.q.trim().slice(0, 100) : "";
  const status = raw.status === "active" || raw.status === "inactive" ? raw.status : "";
  const page = typeof raw.page === "string" && /^\d{1,5}$/.test(raw.page) ? Math.max(1, Number(raw.page)) : 1;
  const db = await createClient();
  let request = db.from("categories").select("*").order("sort_order").order("name").order("id").range((page - 1) * 20, page * 20);
  if (query) request = request.ilike("name", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
  if (status) request = request.eq("is_active", status === "active");
  const [result, choices] = await Promise.all([request, db.from("categories").select("id,name", { count: "exact" }).order("name").limit(1000)]);
  if ((result.error && result.error.code !== "PGRST103") || choices.error) throw new Error(`Failed to load categories: ${result.error?.message ?? choices.error?.message}`);
  const categories = result.data ?? [];
  const counts = await db.rpc("admin_category_product_counts", { p_ids: categories.slice(0, 20).map((category) => category.id) });
  if (counts.error) throw new Error(`Failed to load category product counts: ${counts.error.message}`);
  const productCounts = new Map(counts.data.map((row) => [row.category_id, Number(row.product_count)]));
  const url = (p: number) => `?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}), page: String(p) })}`;
  return <><AdminPageHeading title="Категорії" description="Категорії, порядок та прив’язані товари." />
    <form className="mb-4 flex flex-wrap gap-2 rounded-xl border bg-white p-4"><input name="q" defaultValue={query} placeholder="Пошук за назвою" aria-label="Пошук категорій" className="h-10 min-w-0 flex-1 rounded border px-3 text-sm" /><select name="status" defaultValue={status} aria-label="Статус" className="h-10 rounded border bg-white px-3 text-sm"><option value="">Усі статуси</option><option value="active">Активні</option><option value="inactive">Неактивні</option></select><button className="h-10 rounded bg-slate-900 px-4 text-sm text-white">Застосувати</button></form>
    {(choices.count ?? 0) > (choices.data?.length ?? 0) && <p role="alert" className="mb-4 text-sm text-amber-700">Список категорій для перенесення обмежений першими 1000 записами.</p>}
    <CategoryManager categories={categories.slice(0, 20).map((category) => ({ ...category, imageSrc: categoryImageUrl(category.image_url), product_count: productCounts.get(category.id) ?? 0 }))} choices={choices.data ?? []} />
    <div className="mt-4 flex justify-between text-sm text-slate-600"><span>Сторінка {page}</span><div className="flex gap-4">{page > 1 && <Link href={url(page - 1)}>Назад</Link>}{categories.length > 20 && <Link href={url(page + 1)}>Далі</Link>}</div></div>
  </>;
}
