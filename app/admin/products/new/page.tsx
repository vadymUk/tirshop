import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NewProductPage() {
  await requireActiveAdmin();
  const db = await createClient();
  const [result, settings] = await Promise.all([db.from("categories").select("id,name").order("name"), db.rpc("get_admin_site_settings")]);
  if (result.error || settings.error || !settings.data?.[0]) throw new Error(`Failed to load product form: ${result.error?.message ?? settings.error?.message ?? "missing settings"}`);
  return <><AdminPageHeading title="Новий товар" description="Створення товару в каталозі." /><ProductForm categories={result.data} defaultCurrency={settings.data[0].currency} /></>;
}
