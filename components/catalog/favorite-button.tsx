"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLoginPrompt } from "@/components/catalog/use-login-prompt";
import { adjustFavoritesCount } from "@/components/layout/favorites-count-store";
import { setFavoriteAction } from "@/lib/catalog/actions";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

type FavoriteButtonProps = {
  productId: string;
  productName: string;
  initialIsFavorite: boolean;
  isAuthenticated: boolean;
  className?: string;
  /** Fires optimistically on click and again with the previous value if the request fails. */
  onFavoriteChange?: (productId: string, isFavorite: boolean) => void;
};

export function FavoriteButton({
  productId,
  productName,
  initialIsFavorite,
  isAuthenticated,
  className,
  onFavoriteChange,
}: FavoriteButtonProps) {
  const { t } = useLanguage();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, startTransition] = useTransition();
  const promptLogin = useLoginPrompt();

  function apply(value: boolean) {
    setIsFavorite(value);
    adjustFavoritesCount(value ? 1 : -1);
    onFavoriteChange?.(productId, value);
  }

  function handleClick() {
    if (!isAuthenticated) {
      promptLogin(t("Sign in to save favorites."));
      return;
    }

    const next = !isFavorite;
    apply(next); // optimistic; rolled back on failure
    startTransition(async () => {
      try {
        const result = await setFavoriteAction({ productId, isFavorite: next });
        if (!result.success) {
          apply(!next);
          if (result.unauthenticated) promptLogin(t("Your session has expired."));
          else toast.error(t(result.error));
        }
      } catch {
        apply(!next);
        toast.error(t("Network error. Please check your connection and try again."));
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite
          ? t("Remove {name} from favorites").replace("{name}", productName)
          : t("Add {name} to favorites").replace("{name}", productName)
      }
      className={cn("rounded-full bg-background/90", className)}
    >
      <Heart
        aria-hidden="true"
        className={cn("size-5", isFavorite && "fill-red-500 text-red-500")}
      />
    </Button>
  );
}
