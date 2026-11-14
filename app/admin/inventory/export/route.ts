import { getAdminUser } from "@/lib/admin/auth";
import { fetchInventory } from "@/lib/admin/inventory-data";
import { inventoryCsv, parseInventoryFilter } from "@/lib/admin/inventory";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const params = new URL(request.url).searchParams;
  const input: Record<string, string | string[] | undefined> = {};
  for (const key of ["q", "status"]) {
    const values = params.getAll(key);
    input[key] = values.length > 1 ? values : values[0];
  }
  const parsed = parseInventoryFilter(input);
  if (!parsed.filter) return new Response(parsed.error, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const filter = parsed.filter;
  const db = await createClient();
  let rows = await fetchInventory(db, filter, 0, 101);
  let offset = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset > 0) rows = await fetchInventory(db, filter, offset, 101);
      controller.enqueue(encoder.encode(inventoryCsv(rows.slice(0, 100), offset === 0)));
      if (rows.length <= 100) controller.close();
      else {
        offset += 100;
        if (offset > 2147483647) throw new Error("Inventory export exceeds the maximum offset");
      }
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="inventory.csv"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
