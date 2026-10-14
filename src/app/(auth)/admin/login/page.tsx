import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const notices: Record<string, string> = {
  inactive: "This account has been deactivated. Contact the owner.",
  not_staff: "This account doesn't have access to Solei Admin.",
  link: "That link is invalid or has expired. Ask for a new one.",
};

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <>
      <h1 className="text-4xl">Welcome back</h1>
      <p className="text-ink-muted mt-2 mb-8 text-sm">Sign in to Solei Admin.</p>
      <Suspense>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/admin/login">["searchParams"];
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? notices[sp.error] : undefined;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <LoginForm next={next} notice={error} />;
}
