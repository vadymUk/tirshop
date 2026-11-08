"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import { useLanguage } from "@/components/layout/language-provider";

export function ForgotPasswordForm() {
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = (values: ForgotPasswordInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.success) {
        setSuccess(t(result.message ?? "Check your email."));
        toast.success(t("Reset link requested"));
      } else {
        setServerError(t(result.error));
        toast.error(t(result.error));
      }
    });
  };

  if (success) return <FormAlert variant="success">{success}</FormAlert>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <FormAlert variant="error">{serverError}</FormAlert>}
      <FormField
        id="email"
        label={t("Email")}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <SubmitButton pending={pending} pendingText="Sending…">
        {t("Send reset link")}
      </SubmitButton>
    </form>
  );
}
