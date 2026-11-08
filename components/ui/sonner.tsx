"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useLanguage } from "@/components/layout/language-provider";

export function Toaster(props: ToasterProps) {
  const { t } = useLanguage();

  return (
    <Sonner
      richColors
      closeButton
      position="bottom-right"
      offset={24}
      mobileOffset={16}
      toastOptions={{ closeButtonAriaLabel: t("Close notification") }}
      customAriaLabel={t("Notifications")}
      {...props}
    />
  );
}
