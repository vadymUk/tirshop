"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { signInAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { useLanguage } from "@/components/layout/language-provider";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (values: LoginInput) => {
    setServerError(null);
    startTransition(async () => {
      // On success the action redirects and never resolves with a value.
      const result = await signInAction(values, next);
      if (result && !result.success) {
        setServerError(t(result.error));
        toast.error(t(result.error));
        Object.entries(result.fieldErrors ?? {}).forEach(([name, msgs]) => {
          if (msgs?.[0]) setError(name as keyof LoginInput, { message: msgs[0] });
        });
      }
    });
  };

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
      <FormField
        id="password"
        label={t("Password")}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="text-right text-sm">
        <Link href="/auth/forgot-password" className="underline">
          {t("Forgot password?")}
        </Link>
      </div>
      <SubmitButton pending={pending} pendingText="Signing in…">
        {t("Sign in")}
      </SubmitButton>
    </form>
  );
}
