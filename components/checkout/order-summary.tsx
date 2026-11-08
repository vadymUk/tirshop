import Link from "next/link";
import { ProductImage } from "@/components/product/product-image";
import type { CartData } from "@/lib/cart/types";
import { formatPrice } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

/** Read-only summary of the server-computed cart (display only; the order is priced again in SQL). */
export async function OrderSummary({ cart }: { cart: CartData }) {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  return (
    <aside
      aria-labelledby="order-summary-heading"
      className="h-fit space-y-4 rounded-lg border bg-card p-5 lg:sticky lg:top-32"
    >
      <h2 id="order-summary-heading" className="text-lg font-semibold">
        {t("Order summary")}
      </h2>
      <ul className="divide-y">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex gap-3 py-3">
            <div className="w-14 shrink-0">
              <ProductImage
                storagePath={line.imagePath}
                alt={line.imageAlt}
                preset="thumbnail"
                sizes="56px"
              />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="line-clamp-2 font-medium">{t(line.name)}</p>
              <p className="text-muted-foreground">
                {line.quantity} × {formatPrice(line.unitPrice, line.currency ?? undefined)}
              </p>
            </div>
            <p className="text-sm font-medium">
              {formatPrice(line.lineTotal, line.currency ?? undefined)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="flex items-baseline justify-between border-t pt-4">
        <dt className="font-medium">{t("Total")}</dt>
        <dd className="text-xl font-bold">
          {formatPrice(cart.total, cart.currency ?? undefined)}
        </dd>
      </dl>
      <Link href="/cart" className="text-sm underline">
        {t("Edit cart")}
      </Link>
    </aside>
  );
}
