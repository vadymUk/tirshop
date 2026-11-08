"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ShopError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">We couldn&apos;t load this page</h1>
      <p className="text-muted-foreground">
        The catalog is temporarily unavailable. Please try again.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
