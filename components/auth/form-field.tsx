"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/layout/language-provider";

type FormFieldProps = React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
};

/** Labelled input with accessible error wiring; works with react-hook-form's register(). */
export function FormField({ id, label, error, ...props }: FormFieldProps) {
  const { t } = useLanguage();
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t(label)}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}
