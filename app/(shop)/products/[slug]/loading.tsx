import { Skeleton } from "@/components/ui/skeleton";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export default async function Loading() {
  const language = await getLanguage();
  const label = translate(language, "Loading product");

  return (
    <div className="space-y-8" role="status" aria-label={label}>
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
