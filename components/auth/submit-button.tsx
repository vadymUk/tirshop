"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/layout/language-provider";

type SubmitButtonProps = {
  pending: boolean;
  children: React.ReactNode;
  pendingText?: string;
};

export function SubmitButton({ pending, children, pendingText }: SubmitButtonProps) {
  const { t } = useLanguage();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {pending
        ? t(pendingText ?? "Please wait…")
        : typeof children === "string"
          ? t(children)
          : children}
    </Button>
  );
}
