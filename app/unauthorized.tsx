import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 py-12">
      <h1 className="text-2xl font-bold">401 — Потрібен вхід</h1>
      <p className="text-muted-foreground">
        Увійдіть за зареєстрованою електронною адресою та паролем адміністратора.
      </p>
      <Link
        href="/auth/login?next=%2Fadmin"
        className={buttonVariants()}
      >
        Увійти
      </Link>
    </main>
  );
}
