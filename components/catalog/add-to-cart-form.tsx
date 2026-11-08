"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { AddToCartButton } from "@/components/catalog/add-to-cart-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_CART_LINE_QUANTITY } from "@/lib/catalog/config";
import { useLanguage } from "@/components/layout/language-provider";

type AddToCartFormProps = {
  productId: string;
  productName: string;
  stockQuantity: number;
  initialCartQuantity: number;
  isAuthenticated: boolean;
};

export function AddToCartForm({
  productId,
  productName,
  stockQuantity,
  initialCartQuantity,
  isAuthenticated,
}: AddToCartFormProps) {
  const { t } = useLanguage();
  const [inCart, setInCart] = useState(initialCartQuantity);
  const [quantity, setQuantity] = useState(1);

  // Units still available to add: stock minus what the user already holds.
  const available = Math.max(
    0,
    Math.min(stockQuantity - inCart, MAX_CART_LINE_QUANTITY - inCart),
  );
  const inputId = `quantity-${productId}`;

  const clamp = (value: number) =>
    Math.min(Math.max(Number.isFinite(value) ? value : 1, 1), Math.max(available, 1));

  if (stockQuantity <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("This product is currently out of stock.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {available === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("You already have the maximum available quantity ({count}) in your cart.").replace("{count}", String(inCart))}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor={inputId}>{t("Quantity")}</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Decrease quantity")}
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => clamp(q - 1))}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={1}
                max={available}
                value={quantity}
                onChange={(e) => setQuantity(clamp(Number.parseInt(e.target.value, 10)))}
                className="w-16 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("Increase quantity")}
                disabled={quantity >= available}
                onClick={() => setQuantity((q) => clamp(q + 1))}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </div>
          <AddToCartButton
            productId={productId}
            productName={productName}
            isAuthenticated={isAuthenticated}
            quantity={quantity}
            className="h-10 min-w-40"
            onAdded={(cartQuantity) => {
              setInCart(cartQuantity);
              setQuantity(1);
            }}
          />
        </div>
      )}
      {inCart > 0 && available > 0 && (
        <p className="text-sm text-muted-foreground">
          {inCart} {t("already in your cart · up to")} {available} {t("more")} {t("available")}.
        </p>
      )}
    </div>
  );
}
