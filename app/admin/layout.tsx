import type { Metadata } from "next";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Адміністрування",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireActiveAdmin();
  return <AdminShell email={user.email ?? "Адміністратор"}>{children}</AdminShell>;
}
