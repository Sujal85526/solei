import type { Metadata } from "next";
import { SetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Choose a password" };

export default function SetPasswordPage() {
  return (
    <>
      <h1 className="text-4xl">Choose a password</h1>
      <p className="text-ink-muted mt-2 mb-8 text-sm">
        You&apos;ll use it with your email to sign in to Solei Admin.
      </p>
      <SetPasswordForm />
    </>
  );
}
