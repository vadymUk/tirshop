import { AdminPageHeading } from "@/components/admin/admin-ui";
import { StoreSettingsEditor } from "@/components/admin/store-settings-editor";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  await requireActiveAdmin();
  const result = await (await createClient()).rpc("get_admin_site_settings");
  if (result.error || !result.data?.[0]) throw new Error(`Не вдалося завантажити налаштування: ${result.error?.message ?? "запис відсутній"}`);
  return <><AdminPageHeading title="Налаштування магазину" description="Зміни зберігаються окремо для кожного розділу." /><StoreSettingsEditor settings={result.data[0]} /></>;
}
