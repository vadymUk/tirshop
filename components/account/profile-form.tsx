"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormAlert } from "@/components/auth/form-alert";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { updateProfileAction } from "@/lib/account/actions";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { useLanguage } from "@/components/layout/language-provider";

export function ProfileForm({ defaultValues }: { defaultValues: ProfileInput }) {
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues });

  const onSubmit = (values: ProfileInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result.success) {
        toast.success(t(result.message ?? "Збережено."));
        return;
      }
      setServerError(t(result.error));
      toast.error(t(result.error));
      Object.entries(result.fieldErrors ?? {}).forEach(([name, msgs]) => {
        if (msgs?.[0]) setError(name as keyof ProfileInput, { message: msgs[0] });
      });
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <FormAlert variant="error">{serverError}</FormAlert>}
      <FormField
        id="fullName"
        label={t("Ім'я та прізвище")}
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        id="phone"
        label={t("Телефон")}
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <SubmitButton pending={pending} pendingText="Збереження…">
        {t("Зберегти зміни")}
      </SubmitButton>
    </form>
  );
}