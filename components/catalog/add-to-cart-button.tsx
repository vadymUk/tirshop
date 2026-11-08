"use client";

import { useTransition } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCartCount } from "@/components/cart/cart-count-store";
import { useLoginPrompt } from "@/components/catalog/use-login-prompt";
import { addToCartAction } from "@/lib/catalog/actions";
import { useLanguage } from "@/components/layout/language-provider";

type AddToCartButtonProps = {
  productId: string;
  productName: string;
  isAuthenticated: boolean;
  disabled?: boolean;
  quantity?: number;
  className?: string;
  /** Called with the new total quantity of this product in the cart. */
  onAdded?: (cartQuantity: number) => void;
};

export function AddToCartButton({
  productId,
  productName,
  isAuthenticated,
  disabled,
  quantity = 1,
  className,
  onAdded,
}: AddToCartButtonProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const promptLogin = useLoginPrompt();

  function handleClick() {
    if (!isAuthenticated) {
      promptLogin(t("Sign in to add items to your cart."));
      return;
    }

    startTransition(async () => {
      try {
        const result = await addToCartAction({ productId, quantity });
        if (!result.success) {
          if (result.unauthenticated) promptLogin(t("Your session has expired."));
          else toast.error(t(result.error));
          return;
        }
        toast.success(t("Added {name} to cart").replace("{name}", productName));
        setCartCount(result.cartCount);
        onAdded?.(result.quantity);
      } catch {
        toast.error(t("Network error. Please check your connection and try again."));
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || isPending}
      className={className}
    >
      {isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <ShoppingCart aria-hidden="true" />
      )}
      {t("Add to cart")}
      <span className="sr-only"> {productName}</span>
    </Button>
  );
}
