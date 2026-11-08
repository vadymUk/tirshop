import "server-only";
import { Resend } from "resend";
import { getEmailEnv } from "@/lib/env";

let client: Resend | null = null;

export function getResend() {
  client ??= new Resend(getEmailEnv().RESEND_API_KEY);
  return client;
}

export function getFromAddress() {
  return getEmailEnv().RESEND_FROM_EMAIL;
}

export function getSellerEmail() {
  return getEmailEnv().SELLER_EMAIL;
}
