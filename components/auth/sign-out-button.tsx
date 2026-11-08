"use client";

import { useState, type ComponentProps, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/layout/language-provider";

type SignOutButtonProps = ComponentProps<typeof Button> & {
  pendingText?: string;
};

export function SignOutButton({
  children,
  onClick,
  pendingText = "Вихід…",
  ...props
}: SignOutButtonProps) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  const handleSignOut = async (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || pending) return;
    setPending(true);

    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) {
        console.error("Failed to sign out:", error);
        toast.error(t("Не вдалося вийти з акаунта. Спробуйте ще раз."));
        setPending(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out:", error);
      toast.error(t("Не вдалося вийти з акаунта. Спробуйте ще раз."));
      setPending(false);
    }
  };

  return (
    <Button
      {...props}
      type="button"
      disabled={pending || props.disabled}
      aria-busy={pending}
      onClick={handleSignOut}
    >
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {pending ? t(pendingText) : typeof children === "string" ? t(children) : children}
    </Button>
  );
}
