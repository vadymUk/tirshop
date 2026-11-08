import "server-only";
import {
  PaymentError,
  type PaymentProvider,
  type PaymentProviderId,
} from "@/lib/payments/types";

/**
 * Registry of available payment providers. Intentionally empty: adding a provider means
 * writing an adapter that implements PaymentProvider and registering it once at startup
 * (e.g. registerPaymentProvider(stripeProvider)). No provider is integrated yet.
 */
const providers = new Map<PaymentProviderId, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider) {
  providers.set(provider.id, provider);
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  const provider = providers.get(id);
  if (!provider) throw new PaymentError("provider_not_configured", `No provider "${id}"`);
  return provider;
}
