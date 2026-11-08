import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export default async function Loading() {
  const language = await getLanguage();
  const label = translate(language, "Loading cart");

  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-4 p-4">
              <div className="size-24 animate-pulse rounded-md bg-muted" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-lg border bg-muted/40" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
