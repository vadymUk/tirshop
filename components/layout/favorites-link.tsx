"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { CountBadge } from "@/components/layout/count-badge";
import { useLanguage } from "@/components/layout/language-provider";
import {
  getFavoritesDeltaSnapshot,
  resetFavoritesDelta,
  subscribeFavoritesDelta,
} from "@/components/layout/favorites-count-store";
import { cn } from "@/lib/utils";

export function FavoritesLink({
  initialCount,
  className,
}: {
  initialCount: number;
  className?: string;
}) {
  const { t } = useLanguage();
  const delta = useSyncExternalStore(
    subscribeFavoritesDelta,
    getFavoritesDeltaSnapshot,
    () => 0,
  );
  const count = Math.max(0, initialCount + delta);

  // A fresh server-rendered count supersedes any client-side adjustment.
  useEffect(() => {
    resetFavoritesDelta();
  }, [initialCount]);

  return (
    <Link
      href="/favorites"
      aria-label={count > 0 ? `${t("Обране")}, ${t("товарів")}: ${count}` : t("Обране")}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Heart className="size-5" aria-hidden="true" />
      <CountBadge count={count} />
    </Link>
  );
}
