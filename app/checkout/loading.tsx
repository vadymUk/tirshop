import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export default async function Loading() {
  const language = await getLanguage();
  const label = translate(language, "Loading checkout");

  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border bg-muted/40" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
