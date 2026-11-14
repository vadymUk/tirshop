import { redirect } from "next/navigation";
import { requireActiveAdmin } from "@/lib/admin/auth";

export default async function BannersPage() {
  await requireActiveAdmin();
  redirect("/admin/homepage#banners");
}
