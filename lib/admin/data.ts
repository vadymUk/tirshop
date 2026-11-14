import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAdmin } from "@/lib/admin/auth";
import type { AdminRow } from "@/components/admin/admin-ui";

const pageSize = 20;
const date = (value: string) => new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
const yes = (value: boolean) => value ? "Так" : "Ні";

type ListResult = { columns: string[]; rows: AdminRow[]; hasNext: boolean; searchable: boolean };
type Result<T> = { data: T[] | null; error: { message: string; code?: string } | null };

function list<T>(result: Result<T>, columns: string[], map: (row: T) => AdminRow, searchable = true): ListResult {
  if (result.error && result.error.code !== "PGRST103") throw new Error(`Failed to load admin list: ${result.error.message}`);
  const rows = result.data ?? [];
  return { columns, rows: rows.slice(0, pageSize).map(map), hasNext: rows.length > pageSize, searchable };
}

export async function getAdminList(section: string, page: number, query: string): Promise<ListResult | null> {
  await requireActiveAdmin();
  const db = await createClient();
  const start = (page - 1) * pageSize;
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;

  switch (section) {
    case "products": {
      let request = db.from("products").select("id,name,sku,price,currency,stock_quantity,is_active").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
      if (query) request = request.ilike("name", pattern);
      return list(await request, ["Товар", "Артикул", "Ціна", "Залишок", "Активний"], (r) => ({ id: r.id, href: `/admin/products/${r.id}/edit`, cells: [r.name, r.sku ?? "—", `${r.price} ${r.currency}`, String(r.stock_quantity), yes(r.is_active)] }));
    }
    case "categories": {
      let request = db.from("categories").select("id,name,slug,sort_order,is_active").order("sort_order").order("id").range(start, start + pageSize);
      if (query) request = request.ilike("name", pattern);
      return list(await request, ["Категорія", "Slug", "Порядок", "Активна"], (r) => ({ id: r.id, cells: [r.name, r.slug, String(r.sort_order), yes(r.is_active)] }));
    }
    case "orders": {
      let request = db.from("orders").select("id,order_number,customer_name,status,total_amount,currency,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
      if (query) request = request.ilike("customer_name", pattern);
      return list(await request, ["Замовлення", "Клієнт", "Статус", "Сума", "Дата"], (r) => ({ id: r.id, href: `/admin/orders/${r.id}`, cells: [`#${r.order_number}`, r.customer_name, r.status, `${r.total_amount} ${r.currency}`, date(r.created_at)] }));
    }
    case "customers": {
      let request = db.from("profiles").select("id,full_name,phone,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
      if (query) request = request.ilike("full_name", pattern);
      return list(await request, ["Клієнт", "Телефон", "Дата реєстрації"], (r) => ({ id: r.id, href: `/admin/customers/${r.id}`, cells: [r.full_name || "Без імені", r.phone ?? "—", date(r.created_at)] }));
    }
    case "media": {
      let request = db.from("product_images").select("id,product_id,storage_path,alt_text,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
      if (query) request = request.ilike("storage_path", pattern);
      return list(await request, ["Шлях", "Опис", "Товар", "Дата"], (r) => ({ id: r.id, href: `/admin/products/${r.product_id}/edit`, cells: [r.storage_path, r.alt_text ?? "—", r.product_id, date(r.created_at)] }));
    }
    case "banners": {
      let request = db.from("banners").select("id,title,position,is_active,sort_order").order("sort_order").order("id").range(start, start + pageSize);
      if (query) request = request.ilike("title", pattern);
      return list(await request, ["Банер", "Позиція", "Порядок", "Активний"], (r) => ({ id: r.id, cells: [r.title, r.position, String(r.sort_order), yes(r.is_active)] }));
    }
    case "homepage": {
      let request = db.from("homepage_sections").select("id,section_key,title,section_type,is_visible,sort_order").order("sort_order").order("id").range(start, start + pageSize);
      if (query) request = request.ilike("section_key", pattern);
      return list(await request, ["Ключ", "Назва", "Тип", "Порядок", "Видимий"], (r) => ({ id: r.id, cells: [r.section_key, r.title ?? "—", r.section_type, String(r.sort_order), yes(r.is_visible)] }));
    }
    case "pages":
    case "seo": {
      let request = db.from("pages").select("id,title,slug,is_published,meta_title,meta_description").order("title").order("id").range(start, start + pageSize);
      if (query) request = request.ilike("title", pattern);
      return section === "seo"
        ? list(await request, ["Сторінка", "Slug", "Meta title", "Meta description"], (r) => ({ id: r.id, cells: [r.title, r.slug, r.meta_title ?? "—", r.meta_description ?? "—"] }))
        : list(await request, ["Сторінка", "Slug", "Опублікована"], (r) => ({ id: r.id, cells: [r.title, r.slug, yes(r.is_published)] }));
    }
    case "activity": {
      const request = db.from("admin_activity_logs").select("id,action,entity_type,entity_id,admin_user_id,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
      return list(await request, ["Дія", "Об’єкт", "ID об’єкта", "Адміністратор", "Дата"], (r) => ({ id: r.id, cells: [r.action, r.entity_type, r.entity_id ?? "—", r.admin_user_id ?? "—", date(r.created_at)] }), false);
    }
    case "inventory": {
      const request = db.from("inventory_logs").select("id,product_id,change_type,previous_quantity,new_quantity,quantity_change,created_at").order("created_at", { ascending: false }).order("id").range(start, start + pageSize);
      return list(await request, ["Товар", "Тип", "Було", "Стало", "Зміна", "Дата"], (r) => ({ id: r.id, href: r.product_id ? `/admin/products/${r.product_id}/edit` : undefined, cells: [r.product_id ?? "Видалений товар", r.change_type, r.previous_quantity === null ? "—" : String(r.previous_quantity), String(r.new_quantity), String(r.quantity_change), date(r.created_at)] }), false);
    }
    default: return null;
  }
}

export async function getDashboardStats() {
  await requireActiveAdmin();
  const db = await createClient();
  const results = await Promise.all([
    db.from("products").select("id", { count: "exact", head: true }),
    db.from("orders").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("products").select("id", { count: "exact", head: true }).lte("stock_quantity", 5),
  ]);
  for (const result of results) if (result.error || result.count === null) throw new Error(`Failed to load dashboard statistics: ${result.error?.message ?? "missing count"}`);
  return { products: results[0].count!, orders: results[1].count!, customers: results[2].count!, lowStock: results[3].count! };
}
