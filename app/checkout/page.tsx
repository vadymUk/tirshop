import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { OrderSummary } from "@/components/checkout/order-summary";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/db/queries/cart";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");

  // Re-read live prices and stock on the server; never rely on what the browser displayed.
  const [cart, profile, language] = await Promise.all([
    getCart(),
    getCurrentProfile(),
    getLanguage(),
  ]);
  const t = (source: string) => translate(language, source);
  if (!cart.canCheckout) redirect("/cart");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Checkout")}</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <CheckoutForm
          defaultValues={{
            fullName: profile?.full_name ?? "",
            email: user.email ?? "",
            phone: profile?.phone ?? "",
          }}
        />
        <OrderSummary cart={cart} />
      </div>
    </div>
  );
}
