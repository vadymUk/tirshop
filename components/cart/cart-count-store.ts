// Tiny client-side store so the header badge can follow cart changes without a reload.
// It only mirrors the count returned by server actions; Supabase stays the source of truth.

let override: number | null = null;
const listeners = new Set<() => void>();

export function setCartCount(count: number | null) {
  override = count;
  listeners.forEach((listener) => listener());
}

export function subscribeCartCount(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCartCountSnapshot() {
  return override;
}
