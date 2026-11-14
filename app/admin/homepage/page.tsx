import { AdminPageHeading } from "@/components/admin/admin-ui";
import { HomepageEditor } from "@/components/admin/homepage-editor";
import { getHomepageEditor } from "@/lib/homepage/data";

export default async function HomepageAdminPage() {
  const data = await getHomepageEditor();
  return <><AdminPageHeading title="Головна сторінка" description="Редагуйте приватну чернетку, перевіряйте та публікуйте зміни." /><HomepageEditor {...data} /></>;
}
