"use client";

import { NavLink } from "@/components/layout/nav-link";
import { useLanguage } from "@/components/layout/language-provider";

export function AccountNav() {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("Особистий кабінет")} className="flex gap-1 border-b pb-2">
      <NavLink href="/account">{t("Профіль")}</NavLink>
      <NavLink href="/account/orders" matchPrefix>
        {t("Замовлення")}
      </NavLink>
    </nav>
  );
}