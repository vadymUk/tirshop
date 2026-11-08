"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AccountError({
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
      <h1 className="text-2xl font-semibold">We couldn&apos;t load your account</h1>
      <p className="text-muted-foreground">Please check your connection and try again.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
