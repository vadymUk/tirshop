"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { setCartCount } from "@/components/cart/cart-count-store";
import { Label } from "@/components/ui/label";
import { placeOrderAction } from "@/lib/checkout/actions";
import { SHIPPING_COUNTRIES } from "@/lib/checkout/countries";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { useLanguage } from "@/components/layout/language-provider";

const controlClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-invalid:border-destructive md:text-sm";

type CheckoutFormProps = {
  defaultValues: Pick<CheckoutInput, "fullName" | "email" | "phone">;
};

export function CheckoutForm({ defaultValues }: CheckoutFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      ...defaultValues,
      country: undefined,
      city: "",
      postalCode: "",
      address: "",
      apartment: "",
      notes: "",
      acceptTerms: false,
    },
  });

  const onSubmit = (values: CheckoutInput) => {
    setServerError(null);
    startTransition(async () => {
      try {
        const result = await placeOrderAction(values);

        if (result.success) {
          // The cart was cleared by the order; reflect that in the header right away.
          setCartCount(0);
          router.push(`/checkout/success?order=${result.orderId}`);
          return;
        }

        if (result.unauthenticated) {
          router.push("/auth/login?next=%2Fcheckout");
          return;
        }

        setServerError(t(result.error));
        toast.error(t(result.error));
        const fieldNames = [
          "fullName",
          "email",
          "phone",
          "country",
          "city",
          "postalCode",
          "address",
          "apartment",
          "notes",
          "acceptTerms",
        ] as const;
        fieldNames.forEach((name) => {
          const message = result.fieldErrors?.[name]?.[0];
          if (message) setError(name, { message });
        });
        if (result.cartInvalid) router.push("/cart");
      } catch {
        const message = t("Network error. Please check your connection and try again.");
        setServerError(message);
        toast.error(message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {serverError && <FormAlert variant="error">{serverError}</FormAlert>}

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="mb-2 text-lg font-semibold">{t("Customer information")}</legend>
        <FormField
          id="fullName"
          label={t("Full name")}
          autoComplete="name"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="email"
            label={t("Email")}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <FormField
            id="phone"
            label={t("Phone")}
            type="tel"
            autoComplete="tel"
            placeholder="+380 50 123 4567"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="mb-2 text-lg font-semibold">{t("Shipping address")}</legend>
        <div className="space-y-2">
          <Label htmlFor="country">{t("Country")}</Label>
          <select
            id="country"
            autoComplete="country-name"
            defaultValue=""
            aria-invalid={errors.country ? true : undefined}
            aria-describedby={errors.country ? "country-error" : undefined}
            className={`h-10 ${controlClass}`}
            {...register("country")}
          >
            <option value="" disabled className="bg-background text-foreground">
              {t("Select a country")}
            </option>
            {SHIPPING_COUNTRIES.map((country) => (
              <option key={country} value={country} className="bg-background text-foreground">
                {country}
              </option>
            ))}
          </select>
          {errors.country && (
            <p id="country-error" role="alert" className="text-sm text-destructive">
              {errors.country.message}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="city"
            label={t("City")}
            autoComplete="address-level2"
            error={errors.city?.message}
            {...register("city")}
          />
          <FormField
            id="postalCode"
            label={t("Postal code")}
            autoComplete="postal-code"
            error={errors.postalCode?.message}
            {...register("postalCode")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <FormField
            id="address"
            label={t("Street and number")}
            autoComplete="address-line1"
            error={errors.address?.message}
            {...register("address")}
          />
          <FormField
            id="apartment"
            label={t("Apartment (optional)")}
            autoComplete="address-line2"
            error={errors.apartment?.message}
            {...register("apartment")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="mb-2 text-lg font-semibold">{t("Order notes")}</legend>
        <Label htmlFor="notes">{t("Notes (optional)")}</Label>
        <textarea
          id="notes"
          rows={3}
          maxLength={1000}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? "notes-error" : undefined}
          className={controlClass}
          {...register("notes")}
        />
        {errors.notes && (
          <p id="notes-error" role="alert" className="text-sm text-destructive">
            {errors.notes.message}
          </p>
        )}
      </fieldset>

      <p className="text-sm text-muted-foreground">
        {t("No payment is taken now. We will contact you to confirm the order and agree on the payment method.")}
      </p>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <input
            id="acceptTerms"
            type="checkbox"
            disabled={pending}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-primary"
            {...register("acceptTerms")}
          />
          <label htmlFor="acceptTerms" className="text-sm">
            {t("I have read and accept the")}{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              {t("Умови та положення")}
            </Link>{" "}
            {t("consent-and")}{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              {t("Політика конфіденційності")}
            </Link>
            .
          </label>
        </div>
        {errors.acceptTerms && (
          <p id="acceptTerms-error" role="alert" className="text-sm text-destructive">
            {t(errors.acceptTerms.message ?? "")}
          </p>
        )}
      </div>

      <SubmitButton pending={pending} pendingText="Placing order…">
        {t("Place order")}
      </SubmitButton>
    </form>
  );
}
