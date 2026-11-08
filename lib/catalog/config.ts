import { z } from "zod";

export const PAGE_SIZE = 10;
export const MAX_CART_LINE_QUANTITY = 99;
export const LOW_STOCK_THRESHOLD = 5;
export const MAX_SEARCH_LENGTH = 100;

export const SORT_OPTIONS = {
  newest: { label: "Новинки", column: "created_at", ascending: false },
  price_asc: { label: "Ціна: від нижчої", column: "price", ascending: true },
  price_desc: { label: "Ціна: від вищої", column: "price", ascending: false },
  name: { label: "Назва: А–Я", column: "name", ascending: true },
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

const MAX_FILTER_PRICE = 10_000_000;

const priceSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value.trim() === "") return undefined;
    const number = Number(value.replace(",", "."));
    return Number.isFinite(number) && number >= 0 && number <= MAX_FILTER_PRICE
      ? Math.round(number * 100) / 100
      : undefined;
  });

const listingParamsSchema = z.object({
  sort: z
    .preprocess(
      // Legacy hyphenated values (price-asc) keep working.
      (value) => (typeof value === "string" ? value.replace("-", "_") : value),
      z.enum(Object.keys(SORT_OPTIONS) as [SortKey, ...SortKey[]]),
    )
    .catch("newest"),
  minPrice: priceSchema,
  maxPrice: priceSchema,
  availability: z.enum(["in_stock"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  q: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH))
    .transform((value) => value || undefined)
    .optional()
    .catch(undefined),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,100}$/)
    .optional()
    .catch(undefined),
});

/** Parses untrusted search params; invalid values fall back to defaults. */
export function parseListingParams(raw: {
  sort?: string | string[];
  page?: string | string[];
  q?: string | string[];
  category?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  availability?: string | string[];
}) {
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const parsed = listingParamsSchema.parse({
    sort: first(raw.sort),
    page: first(raw.page),
    q: first(raw.q),
    category: first(raw.category),
    minPrice: first(raw.minPrice),
    maxPrice: first(raw.maxPrice),
    availability: first(raw.availability),
  });
  // A reversed range is swapped rather than returning an empty catalog.
  if (
    parsed.minPrice !== undefined &&
    parsed.maxPrice !== undefined &&
    parsed.minPrice > parsed.maxPrice
  ) {
    [parsed.minPrice, parsed.maxPrice] = [parsed.maxPrice, parsed.minPrice];
  }
  return parsed;
}

export type StockStatus = {
  state: "out" | "low" | "in";
  label: string;
};

export function getStockStatus(stockQuantity: number): StockStatus {
  if (stockQuantity <= 0) return { state: "out", label: "Немає в наявності" };
  if (stockQuantity <= LOW_STOCK_THRESHOLD) {
    return { state: "low", label: "Залишилось лише {count}" };
  }
  return { state: "in", label: "В наявності" };
}
