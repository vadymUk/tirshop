import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/profile-form";
import { FormAlert } from "@/components/auth/form-alert";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Мій профіль" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const user = await requireUser("/account");
  const [profile, { password }, language] = await Promise.all([
    getCurrentProfile(),
    searchParams,
    getLanguage(),
  ]);
  const t = (source: string) => translate(language, source);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t("Мій профіль")}</h1>
      {password === "updated" && (
        <FormAlert variant="success">Пароль успішно оновлено.</FormAlert>
      )}
      {!user.email_confirmed_at && (
        <FormAlert variant="error">Вашу електронну адресу ще не підтверджено.</FormAlert>
      )}
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("Ім'я")}</dt>
        <dd>{profile?.full_name ?? "—"}</dd>
        <dt className="text-muted-foreground">{t("Email")}</dt>
        <dd className="break-all">{user.email}</dd>
        <dt className="text-muted-foreground">{t("Телефон")}</dt>
        <dd>{profile?.phone ?? "—"}</dd>
      </dl>

      <section aria-labelledby="edit-profile" className="space-y-4 border-t pt-6">
        <h2 id="edit-profile" className="text-lg font-semibold">
          {t("Редагувати дані")}
        </h2>
        <ProfileForm
          defaultValues={{ fullName: profile?.full_name ?? "", phone: profile?.phone ?? "" }}
        />
        <p className="text-xs text-muted-foreground">
          {t("Email змінити тут не можна — він використовується для входу.")}
        </p>
      </section>

      <SignOutButton variant="outline" pendingText={t("Вихід…")}>
        {t("Вийти")}
      </SignOutButton>
    </div>
  );
}