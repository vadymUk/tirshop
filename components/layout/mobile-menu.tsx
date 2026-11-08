"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, LogIn, LogOut, Menu, Package, ShoppingCart, UserPlus, UserRound, X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { HeaderCategory } from "@/components/layout/categories-menu";
import { NavLink } from "@/components/layout/nav-link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useLanguage } from "@/components/layout/language-provider";

const rowClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-3 text-base outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

export function MobileMenu({
  categories,
  email,
  siteName,
}: {
  categories: HeaderCategory[];
  email: string | null;
  siteName: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("Відкрити меню")}
        className="inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,100%)] flex-col overflow-y-auto bg-background p-4 shadow-xl outline-none">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-semibold">{siteName}</Dialog.Title>
            <Dialog.Close
              aria-label={t("Закрити меню")}
              className="inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("Навігація по сайту")}</Dialog.Description>

          {/* Any link click inside closes the sheet; the route change is handled by Next. */}
          <nav
            aria-label={t("Мобільне меню")}
            className="flex flex-col gap-1"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) close();
            }}
          >
            <NavLink href="/" className="py-3 text-base">{t("Головна")}</NavLink>
            <NavLink href="/products" matchPrefix className="py-3 text-base">{t("Товари")}</NavLink>
            <NavLink href="/about" className="py-3 text-base">{t("Про нас")}</NavLink>

            {categories.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">
                  {t("Категорії")}
                </p>
                <ul>
                  {categories.map((category) => (
                    <li key={category.id}>
                      <NavLink
                        href={`/category/${category.slug}`}
                        className="block py-3 text-base"
                      >
                        {t(category.name)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1 border-t pt-3">
              <Link href="/favorites" className={rowClass}>
                <Heart className="size-5" aria-hidden="true" /> {t("Обране")}
              </Link>
              <Link href="/cart" className={rowClass}>
                <ShoppingCart className="size-5" aria-hidden="true" /> {t("Кошик")}
              </Link>
              {email ? (
                <>
                  <Link href="/account" className={rowClass}>
                    <UserRound className="size-5" aria-hidden="true" /> {t("Профіль")}
                  </Link>
                  <Link href="/account/orders" className={rowClass}>
                    <Package className="size-5" aria-hidden="true" /> {t("Замовлення")}
                  </Link>
                  <SignOutButton
                    variant="ghost"
                    className={rowClass}
                    pendingText={t("Вихід…")}
                  >
                    <LogOut className="size-5" aria-hidden="true" />
                    {t("Вийти")}
                  </SignOutButton>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className={rowClass}>
                    <LogIn className="size-5" aria-hidden="true" /> {t("Увійти")}
                  </Link>
                  <Link href="/auth/register" className={rowClass}>
                    <UserPlus className="size-5" aria-hidden="true" /> {t("Реєстрація")}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
