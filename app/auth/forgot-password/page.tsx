import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("Forgot password")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Enter your email and we'll send you a reset link.")}
        </p>
      </div>
      <ForgotPasswordForm />
      <Link href="/auth/login" className="text-sm underline">
        {t("Back to sign in")}
      </Link>
    </div>
  );
}
