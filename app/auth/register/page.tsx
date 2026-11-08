import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Create account")}</h1>
      <RegisterForm />
      <p className="text-sm text-muted-foreground">
        {t("Already registered?")}{" "}
        <Link href="/auth/login" className="underline">
          {t("Sign in")}
        </Link>
      </p>
    </div>
  );
}
