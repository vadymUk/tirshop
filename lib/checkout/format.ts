/** Human-readable order number shown to customers, e.g. TS-001042. */
export function formatOrderNumber(orderNumber: number): string {
  return `TS-${String(orderNumber).padStart(6, "0")}`;
}

/** Fixed time zone so the server-rendered page and the email always agree. */
export function formatOrderDate(isoDate: string, locale = "uk-UA"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(new Date(isoDate));
}
