import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/auth/form-alert";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/redirect";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, language] = await Promise.all([searchParams, getLanguage()]);
  const t = (source: string) => translate(language, source);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Sign in")}</h1>
      {error === "link_invalid" && (
        <FormAlert variant="error">
          {t("That link is invalid or has expired. Please try again.")}
        </FormAlert>
      )}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
      <p className="text-sm text-muted-foreground">
        {t("No account yet?")}{" "}
        <Link href="/auth/register" className="underline">
          {t("Create one")}
        </Link>
      </p>
    </div>
  );
}
