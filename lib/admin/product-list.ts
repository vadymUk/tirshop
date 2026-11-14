import { z } from "zod";

const single = z.union([z.string(), z.array(z.string())]).optional().transform((v) => typeof v === "string" ? v : "");
const params = z.object({
  q: single, category: single, status: single, stock: single, min: single, max: single, sort: single, page: single,
});

export function parseProductListParams(input: Record<string, string | string[] | undefined>) {
  const raw = params.parse(input);
  const q = raw.q.trim().replace(/[\\,()"*%]/g, " ").slice(0, 100);
  const category = z.string().uuid().safeParse(raw.category).success ? raw.category : "";
  const status = ["active", "inactive"].includes(raw.status) ? raw.status : "";
  const stock = ["out", "low", "in"].includes(raw.stock) ? raw.stock : "";
  const sort = ["oldest", "name", "price_asc", "price_desc", "stock_asc", "stock_desc"].includes(raw.sort) ? raw.sort : "newest";
  const price = (value: string) => value !== "" && /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 9999999999.99 ? Number(value) : undefined;
  const page = /^\d{1,5}$/.test(raw.page) ? Math.max(1, Number(raw.page)) : 1;
  return { q, category, status, stock, sort, min: price(raw.min), max: price(raw.max), page };
}
