import { z } from "zod";

export const inventoryPageSize = 20;
export const inventoryStatuses = ["all", "in", "low", "out"] as const;
export type InventoryFilter = { query: string; status: (typeof inventoryStatuses)[number]; page: number };
export type InventoryItem = {
  id: string; name: string; sku: string | null; stock_quantity: number; is_active: boolean;
  threshold: number; image_path: string | null; last_stock_update: string | null;
};

export function parseInventoryFilter(input: Record<string, string | string[] | undefined>): { filter?: InventoryFilter; error?: string } {
  const query = input.q ?? "";
  const status = input.status ?? "all";
  const page = input.page ?? "1";
  if (typeof query !== "string" || query.trim().length > 100) return { error: "Пошуковий запит має містити до 100 символів." };
  if (typeof status !== "string" || !inventoryStatuses.some((value) => value === status)) return { error: "Невідомий стан залишку." };
  if (typeof page !== "string" || !/^[1-9]\d{0,6}$/.test(page)) return { error: "Некоректна сторінка." };
  return { filter: { query: query.trim(), status: status as InventoryFilter["status"], page: Number(page) } };
}

const wholeNumber = z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.number().int().min(0).max(1_000_000_000));
export function parseInventoryAdjustment(form: FormData) {
  const entries = form.getAll("items").map((item) => {
    if (typeof item !== "string") return null;
    const [id, stock, extra] = item.split(":");
    if (extra !== undefined) return null;
    const parsedId = z.string().uuid().safeParse(id);
    const parsedStock = z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.number().int().min(0).max(2_147_483_647)).safeParse(stock);
    return parsedId.success && parsedStock.success ? { id: parsedId.data, stock: parsedStock.data } : null;
  });
  const schema = z.object({
    items: z.array(z.object({ id: z.string().uuid(), stock: z.number().int() })).min(1).max(100)
      .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length),
    operation: z.enum(["set", "increase", "decrease"]),
    quantity: wholeNumber,
    reason: z.string().trim().min(1).max(1000),
  }).refine((value) => value.operation === "set" || value.quantity > 0);
  return schema.safeParse({ items: entries, operation: form.get("operation"), quantity: form.get("quantity"), reason: form.get("reason") });
}

export function stockStatus(item: Pick<InventoryItem, "stock_quantity" | "threshold">) {
  return item.stock_quantity === 0 ? "Немає в наявності" : item.stock_quantity <= item.threshold ? "Малий залишок" : "Достатній";
}

export function inventoryCsv(items: InventoryItem[], firstPage: boolean) {
  const rows: (string | number)[][] = firstPage ? [["id", "name", "sku", "stock_quantity", "threshold", "stock_status", "active", "last_stock_update_utc"]] : [];
  for (const item of items) rows.push([item.id, item.name, item.sku ?? "", item.stock_quantity, item.threshold, stockStatus(item), item.is_active ? "yes" : "no", item.last_stock_update ?? ""]);
  const text = rows.map((row) => row.map((value) => {
    const string = String(value);
    const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(string) ? `'${string}` : string;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  return (firstPage ? "\uFEFF" : "") + (text ? `${text}\r\n` : "");
}
