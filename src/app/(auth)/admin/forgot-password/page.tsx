import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-4xl">Reset your password</h1>
      <p className="text-ink-muted mt-2 mb-8 text-sm">
        We&apos;ll email you a link to choose a new one.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
