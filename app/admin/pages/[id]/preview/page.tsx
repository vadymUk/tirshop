import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContent } from "@/components/pages/page-content";
import { getPageEditor } from "@/lib/pages/data";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPageEditor(id);
  if (!page) notFound();
  return <><div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">Приватний перегляд {page.revision ? `чернетки №${page.revision}` : "поточної версії"}. <Link href={`/admin/pages/${id}`} className="text-blue-700 underline">Повернутися до редактора</Link></div><div className="mt-4 rounded-xl border bg-white"><PageContent document={page.document} /></div></>;
}
