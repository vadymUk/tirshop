import { notFound } from "next/navigation";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { PageEditor } from "@/components/admin/page-editor";
import { getPageEditor } from "@/lib/pages/data";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPageEditor(id);
  if (!page) notFound();
  return <><AdminPageHeading title="Редагування сторінки" description="Зміни залишаються приватними до публікації." /><PageEditor id={id} {...page} /></>;
}
