"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import {
  getCartCountSnapshot,
  setCartCount,
  subscribeCartCount,
} from "@/components/cart/cart-count-store";
import { CountBadge } from "@/components/layout/count-badge";
import { useLanguage } from "@/components/layout/language-provider";

export function CartLink({ initialCount }: { initialCount: number }) {
  const { t } = useLanguage();
  const override = useSyncExternalStore(
    subscribeCartCount,
    getCartCountSnapshot,
    () => null,
  );
  const count = override ?? initialCount;

  // A fresh server-rendered count supersedes any client-side value.
  useEffect(() => {
    setCartCount(null);
  }, [initialCount]);

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `${t("Кошик")}, ${t("товарів")}: ${count}` : t("Кошик")}
      className="relative inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      <CountBadge count={count} />
    </Link>
  );
}
