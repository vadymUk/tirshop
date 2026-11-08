"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { signUpAction } from "@/lib/auth/actions";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { useLanguage } from "@/components/layout/language-provider";

export function RegisterForm() {
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = (values: RegisterInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (!result) return; // redirected (email confirmation disabled)
      if (result.success) {
        setSuccess(t(result.message ?? "Check your email to continue."));
        toast.success(t("Account created. Check your email."));
        return;
      }
      setServerError(t(result.error));
      toast.error(t(result.error));
      Object.entries(result.fieldErrors ?? {}).forEach(([name, msgs]) => {
        if (msgs?.[0]) setError(name as keyof RegisterInput, { message: msgs[0] });
      });
    });
  };

  if (success) return <FormAlert variant="success">{success}</FormAlert>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <FormAlert variant="error">{serverError}</FormAlert>}
      <FormField
        id="fullName"
        label={t("Full name")}
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        id="email"
        label={t("Email")}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="password"
        label={t("Password")}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormField
        id="confirmPassword"
        label={t("Confirm password")}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <p className="text-xs text-muted-foreground">
        {t("At least 8 characters, including a letter and a number.")}
      </p>
      <SubmitButton pending={pending} pendingText="Creating account…">
        {t("Create account")}
      </SubmitButton>
    </form>
  );
}
