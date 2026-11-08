"use client";

import { getStockStatus } from "@/lib/catalog/config";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

export function StockBadge({ stockQuantity }: { stockQuantity: number }) {
  const { t } = useLanguage();
  const { state, label } = getStockStatus(stockQuantity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        state === "in" && "bg-green-100 text-green-800",
        state === "low" && "bg-amber-100 text-amber-900",
        state === "out" && "bg-red-100 text-red-800",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          state === "in" && "bg-green-600",
          state === "low" && "bg-amber-600",
          state === "out" && "bg-red-600",
        )}
      />
      {t(label).replace("{count}", String(stockQuantity))}
    </span>
  );
}
