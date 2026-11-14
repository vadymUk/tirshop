import { randomUUID } from "node:crypto";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { PageEditor } from "@/components/admin/page-editor";
import { pageDocumentSchema, emptyPage } from "@/lib/pages/schema";

export default function NewPage() {
  return <><AdminPageHeading title="Нова сторінка" description="Створіть чернетку перед попереднім переглядом." /><PageEditor id={randomUUID()} document={pageDocumentSchema.parse({ ...emptyPage, slug: "new-page", title: "Нова сторінка" })} revision={0} published={false} /></>;
}
