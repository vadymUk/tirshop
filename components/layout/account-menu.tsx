"use client";

import Link from "next/link";
import { LogIn, LogOut, Package, User, UserPlus, UserRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useLanguage } from "@/components/layout/language-provider";

const itemClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent";

/** Account dropdown; `email` is null for guests. */
export function AccountMenu({ email }: { email: string | null }) {
  const { t } = useLanguage();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("Меню акаунта")}
        className="inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
      >
        <User className="size-5" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-md border bg-background p-1 text-foreground shadow-md"
        >
          {email ? (
            <>
              <DropdownMenu.Label className="truncate px-3 py-2 text-xs text-muted-foreground">
                {email}
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link href="/account" className={itemClass}>
                  <UserRound className="size-4" aria-hidden="true" />
                  {t("Профіль")}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link href="/account/orders" className={itemClass}>
                  <Package className="size-4" aria-hidden="true" />
                  {t("Замовлення")}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <SignOutButton
                  variant="ghost"
                  className={itemClass}
                  pendingText={t("Вихід…")}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {t("Вийти")}
                </SignOutButton>
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <DropdownMenu.Item asChild>
                <Link href="/auth/login" className={itemClass}>
                  <LogIn className="size-4" aria-hidden="true" />
                  {t("Увійти")}
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link href="/auth/register" className={itemClass}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  {t("Реєстрація")}
                </Link>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
