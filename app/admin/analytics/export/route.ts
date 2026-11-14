import { getAdminUser } from "@/lib/admin/auth";
import { analyticsCsv, hasMoreAnalytics, parseAnalyticsFilter, reportPageSize } from "@/lib/admin/analytics";
import { fetchEcommerceAnalytics } from "@/lib/admin/analytics-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const params = new URL(request.url).searchParams;
  const input: Record<string, string | string[] | undefined> = {};
  for (const key of ["period", "from", "to", "currency", "bucket"]) {
    const values = params.getAll(key);
    input[key] = values.length > 1 ? values : values[0];
  }
  const parsed = parseAnalyticsFilter(input);
  if (!parsed.filter) return new Response(parsed.error, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const db = await createClient();
  const first = await fetchEcommerceAnalytics(db, parsed.filter);
  const filter = { ...parsed.filter, period: "custom" as const, from: first.from, to: first.to, currency: first.currency };
  let current = first;
  let offset = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset > 0) current = await fetchEcommerceAnalytics(db, filter, offset);
      controller.enqueue(encoder.encode(analyticsCsv(current, offset === 0)));
      if (!hasMoreAnalytics(current)) controller.close();
      else {
        offset += reportPageSize;
        if (offset > 2147483647) throw new Error("Analytics export exceeds the maximum report offset");
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="analytics.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
