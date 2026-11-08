import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/db/queries/cart";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default async function CartPage() {
  await requireUser("/cart");
  const [cart, language] = await Promise.all([getCart(), getLanguage()]);
  const t = (source: string) => translate(language, source);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Shopping cart")}</h1>
      <CartView initialCart={cart} />
    </div>
  );
}
