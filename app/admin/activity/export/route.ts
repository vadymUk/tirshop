import { getAdminUser } from "@/lib/admin/auth";
import { activityCsv, parseActivityFilter } from "@/lib/admin/activity";
import { fetchActivity } from "@/lib/admin/activity-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const params = new URL(request.url).searchParams;
  const input: Record<string, string | string[] | undefined> = {};
  for (const key of ["admin", "action", "entity", "from", "to", "q"]) {
    const values = params.getAll(key);
    input[key] = values.length > 1 ? values : values[0];
  }
  const parsed = parseActivityFilter(input);
  if (!parsed.filter) return new Response(parsed.error, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const filter = parsed.filter;
  const db = await createClient();
  let rows = await fetchActivity(db, filter, 0, 101);
  let offset = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset > 0) rows = await fetchActivity(db, filter, offset, 101);
      controller.enqueue(encoder.encode(activityCsv(rows.slice(0, 100), offset === 0)));
      if (rows.length <= 100) controller.close();
      else {
        offset += 100;
        if (offset > 2147483647) throw new Error("Activity export exceeds the maximum offset");
      }
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="admin-activity.csv"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
