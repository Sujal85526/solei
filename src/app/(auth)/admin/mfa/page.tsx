import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EnrollTotp, VerifyTotp } from "@/components/auth/mfa-forms";
import { resolveStaff } from "@/lib/auth/session";
import { signOutAction } from "@/modules/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function MfaPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted text-sm">Loading…</p>}>
      <MfaStep />
    </Suspense>
  );
}

async function MfaStep() {
  const gate = await resolveStaff();
  if (gate.status === "ok") redirect("/admin");
  if (gate.status === "signed_out") redirect("/admin/login");
  if (gate.status === "inactive" || gate.status === "not_staff")
    redirect(`/admin/login?error=${gate.status}`);

  let body: React.ReactNode;
  if (gate.status === "mfa_verify") {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === "verified");
    if (!factor) redirect("/admin/login");
    body = (
      <>
        <h1 className="text-4xl">Verify it&apos;s you</h1>
        <p className="text-ink-muted mt-2 mb-8 text-sm">
          Enter the code from your authenticator app for {gate.email}.
        </p>
        <VerifyTotp factorId={factor.id} />
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-4xl">Protect your account</h1>
        <p className="text-ink-muted mt-2 mb-8 text-sm">
          Owner and manager accounts need two-factor authentication. Set it up once — it takes a
          minute.
        </p>
        <EnrollTotp />
      </>
    );
  }
  return (
    <>
      {body}
      <form action={signOutAction} className="mt-8 text-center">
        <button className="text-ink-muted text-sm underline-offset-4 hover:underline">
          Use a different account
        </button>
      </form>
    </>
  );
}
