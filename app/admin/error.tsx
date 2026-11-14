"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/admin/admin-ui";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Admin page failed:", error); }, [error]);
  return <ErrorState reset={reset} />;
}
