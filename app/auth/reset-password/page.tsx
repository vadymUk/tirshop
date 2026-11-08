import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/auth/form-alert";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  // The recovery link signs the user in temporarily via /auth/callback.
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Choose a new password")}</h1>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-4">
          <FormAlert variant="error">
            {t("Your reset link is invalid or has expired.")}
          </FormAlert>
          <Link href="/auth/forgot-password" className="text-sm underline">
            {t("Request a new link")}
          </Link>
        </div>
      )}
    </div>
  );
}
