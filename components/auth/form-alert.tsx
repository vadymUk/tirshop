"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

type FormAlertProps = {
  variant: "error" | "success";
  children: React.ReactNode;
};

export function FormAlert({ variant, children }: FormAlertProps) {
  const { t } = useLanguage();
  const Icon = variant === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        variant === "error"
          ? "border-destructive/50 text-destructive"
          : "border-green-600/50 text-green-700 dark:text-green-400",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{typeof children === "string" ? t(children) : children}</div>
    </div>
  );
}
