"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/redirect";
import { isRateLimited } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const invalid = (
  fieldErrors: Record<string, string[] | undefined>,
): ActionResult => ({
  success: false,
  error: "Please correct the highlighted fields.",
  fieldErrors,
});

const TOO_MANY: ActionResult = {
  success: false,
  error: "Too many attempts. Please try again in a few minutes.",
};

export async function signInAction(
  input: unknown,
  next?: string,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  if (await isRateLimited("sign-in", 10, 300)) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      success: false,
      error:
        error.code === "email_not_confirmed"
          ? "Please verify your email address before signing in."
          : "Invalid email or password.",
    };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(next, "/account"));
}

export async function signUpAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  if (await isRateLimited("sign-up", 5, 3600)) return TOO_MANY;

  const { email, password, fullName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }, // copied into profiles by a DB trigger
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account`,
    },
  });

  if (error) {
    return {
      success: false,
      error:
        error.code === "weak_password"
          ? "Password is too weak. Choose a stronger one."
          : "We couldn't create your account. Please try again.",
    };
  }

  // Email confirmation disabled in Supabase: the user is already signed in.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/account");
  }

  // Same response for new and existing emails to avoid account enumeration.
  return {
    success: true,
    message: `We sent a verification link to ${email}. Open it to activate your account.`,
  };
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  if (await isRateLimited("password-reset", 5, 3600)) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/reset-password`,
  });
  if (error) console.error("Password reset email request failed:", error);

  // Always succeed: never reveal whether the email is registered.
  return {
    success: true,
    message:
      "If an account exists for that email, we sent a password reset link.",
  };
}

export async function updatePasswordAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      error: "Your reset link is invalid or has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      success: false,
      error:
        error.code === "same_password"
          ? "Choose a password different from your current one."
          : "We couldn't update your password. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/account?password=updated");
}
