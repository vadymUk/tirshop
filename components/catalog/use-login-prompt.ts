"use client";

import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useLanguage } from "@/components/layout/language-provider";

/**
 * Friendly prompt for guests: explains why sign-in is needed and offers
 * Sign in / Register, both returning to the current page afterwards.
 */
export function useLoginPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const next = encodeURIComponent(pathname);

  return (message: string) =>
    toast(message, {
      description: t("Sign in or create a free account to continue."),
      action: {
        label: t("Sign in"),
        onClick: () => router.push(`/auth/login?next=${next}`),
      },
      cancel: {
        label: t("Register"),
        onClick: () => router.push("/auth/register"),
      },
    });
}
