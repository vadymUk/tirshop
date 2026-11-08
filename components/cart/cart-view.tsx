"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setCartCount } from "@/components/cart/cart-count-store";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import {
  clearCartAction,
  removeFromCartAction,
  updateCartQuantityAction,
  type CartActionResult,
} from "@/lib/cart/actions";
import type { CartData, CartLine } from "@/lib/cart/types";
import { formatPrice } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

const LINE_MESSAGES: Record<Exclude<CartLine["status"], "ok">, string> = {
  unavailable: "This product is no longer available. Remove it to continue.",
  out_of_stock: "This product is out of stock. Remove it to continue.",
  exceeds_stock: "Not enough stock for the quantity in your cart.",
};

export function CartView({ initialCart }: { initialCart: CartData }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [lastInitial, setLastInitial] = useState(initialCart);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Adopt a fresh server render (e.g. after router.refresh()).
  if (initialCart !== lastInitial) {
    setLastInitial(initialCart);
    setCart(initialCart);
  }

  function run(productId: string | null, action: () => Promise<CartActionResult>) {
    setBusyProductId(productId);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success) {
          setCart(result.cart);
          setCartCount(result.cart.itemCount);
          return;
        }
        if (result.unauthenticated) {
          router.push("/auth/login?next=%2Fcart");
          return;
        }
        toast.error(t(result.error));
        // Data may be stale (stock changed, product removed): resync from the server.
        router.refresh();
      } catch {
        toast.error(t("Network error. Please check your connection and try again."));
      } finally {
        setBusyProductId(null);
      }
    });
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title={t("Your cart is empty")}
        description={t("Browse our products and add what you need for the road.")}
        action={
          <Button asChild>
            <Link href="/products">{t("Browse products")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="cart-items-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="cart-items-heading" className="text-lg font-semibold">
            {t("Items")} ({cart.itemCount})
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => run(null, () => clearCartAction())}
          >
            {t("Clear cart")}
          </Button>
        </div>

        <ul className="divide-y rounded-lg border">
          {cart.lines.map((line) => (
            <CartLineItem
              key={line.id}
              line={line}
              disabled={isPending}
              busy={isPending && busyProductId === line.productId}
              onChangeQuantity={(quantity) =>
                run(line.productId, () =>
                  updateCartQuantityAction({ productId: line.productId, quantity }),
                )
              }
              onRemove={() =>
                run(line.productId, () =>
                  removeFromCartAction({ productId: line.productId }),
                )
              }
            />
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="cart-summary-heading"
        className="h-fit space-y-4 rounded-lg border bg-card p-5 lg:sticky lg:top-32"
      >
        <h2 id="cart-summary-heading" className="text-lg font-semibold">
          {t("Order summary")}
        </h2>

        {cart.hasMixedCurrencies ? (
          <p role="alert" className="flex gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("Your cart contains products priced in different currencies. Remove some items to continue.")}
          </p>
        ) : (
          <dl className="flex items-baseline justify-between text-base">
            <dt className="font-medium">{t("Total")}</dt>
            <dd className="text-xl font-bold" aria-live="polite">
              {formatPrice(cart.total, cart.currency ?? undefined)}
            </dd>
          </dl>
        )}

        {cart.hasIssues && (
          <p role="alert" className="flex gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("Some items need your attention before you can check out.")}
          </p>
        )}

        {cart.canCheckout ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/checkout">{t("Proceed to checkout")}</Link>
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled>
            {t("Proceed to checkout")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {t("Prices and stock are confirmed again at checkout.")}
        </p>
      </aside>
    </div>
  );
}

type CartLineItemProps = {
  line: CartLine;
  disabled: boolean;
  busy: boolean;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
};

function CartLineItem({ line, disabled, busy, onChangeQuantity, onRemove }: CartLineItemProps) {
  const { t } = useLanguage();
  const unavailable = line.status === "unavailable" || line.status === "out_of_stock";
  const canIncrease = !unavailable && line.quantity < line.maxQuantity;
  const canDecrease = !unavailable && line.quantity > 1;

  return (
    <li className="flex gap-4 p-4" aria-busy={busy}>
      <div className="w-20 shrink-0 sm:w-24">
        <ProductImage
          storagePath={line.imagePath}
          alt={line.imageAlt}
          preset="thumbnail"
          sizes="96px"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.slug ? (
              <Link
                href={`/products/${line.slug}`}
                className="line-clamp-2 font-medium hover:underline"
              >
                {t(line.name)}
              </Link>
            ) : (
              <p className="font-medium text-muted-foreground">{t(line.name)}</p>
            )}
            {line.currency && (
              <p className="text-sm text-muted-foreground">
                {formatPrice(line.unitPrice, line.currency)} {t("each")}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onRemove}
            aria-label={t("Remove {name} from cart").replace("{name}", line.name)}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
          </Button>
        </div>

        {line.status !== "ok" && (
          <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {line.status === "exceeds_stock"
              ? `${t("Only {count} in stock.").replace("{count}", String(line.stock))} ${t(LINE_MESSAGES.exceeds_stock)}`
              : t(LINE_MESSAGES[line.status])}
            {line.status === "exceeds_stock" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onChangeQuantity(line.maxQuantity)}
              >
                {t("Set to {count}").replace("{count}", String(line.maxQuantity))}
              </Button>
            )}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div
            role="group"
            aria-label={t("Quantity of {name}").replace("{name}", line.name)}
            className="flex items-center gap-1"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || !canDecrease}
              onClick={() => onChangeQuantity(line.quantity - 1)}
              aria-label={t("Decrease quantity of {name}").replace("{name}", line.name)}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span
              className="w-10 text-center text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {line.quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || !canIncrease}
              onClick={() => onChangeQuantity(line.quantity + 1)}
              aria-label={t("Increase quantity of {name}").replace("{name}", line.name)}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
          {line.currency && (
            <p className="font-semibold">{formatPrice(line.lineTotal, line.currency)}</p>
          )}
        </div>
        {!unavailable && line.quantity >= line.maxQuantity && line.status === "ok" && (
          <p className="text-xs text-muted-foreground">{t("Maximum available quantity reached.")}</p>
        )}
      </div>
    </li>
  );
}
