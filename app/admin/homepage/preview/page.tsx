import Link from "next/link";
import { HomeContent } from "@/components/homepage/home-content";
import { getHomepageCatalog, getHomepageEditor, homepageRenderTime } from "@/lib/homepage/data";

export default async function HomepagePreviewPage() {
  const { document, revision } = await getHomepageEditor();
  const [catalog, now] = await Promise.all([getHomepageCatalog(document), homepageRenderTime()]);
  return <><div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">Попередній перегляд {revision ? `збереженої чернетки №${revision}` : "початкових даних"}. Приховані секції та неактивні банери не показуються. <Link className="text-blue-700 underline" href="/admin/homepage">Повернутися до редактора</Link></div><div className="rounded-xl border bg-background p-4 sm:p-8"><HomeContent document={document} catalog={catalog} now={now} /></div></>;
}
