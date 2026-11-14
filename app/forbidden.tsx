import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 py-12">
      <h1 className="text-2xl font-bold">403 — Доступ заборонено</h1>
      <p className="text-muted-foreground">
        Для цієї сторінки потрібен активний обліковий запис адміністратора.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        На головну
      </Link>
    </main>
  );
}
