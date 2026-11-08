"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { updatePasswordAction } from "@/lib/auth/actions";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { useLanguage } from "@/components/layout/language-provider";

export function ResetPasswordForm() {
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = (values: ResetPasswordInput) => {
    setServerError(null);
    startTransition(async () => {
      // On success the action redirects to /account.
      const result = await updatePasswordAction(values);
      if (result && !result.success) {
        setServerError(t(result.error));
        toast.error(t(result.error));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <FormAlert variant="error">{serverError}</FormAlert>}
      <FormField
        id="password"
        label={t("New password")}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormField
        id="confirmPassword"
        label={t("Confirm new password")}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <SubmitButton pending={pending} pendingText="Updating…">
        {t("Update password")}
      </SubmitButton>
    </form>
  );
}
