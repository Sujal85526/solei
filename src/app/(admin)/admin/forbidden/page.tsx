import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export default async function ForbiddenPage({ searchParams }: PageProps<"/admin/forbidden">) {
  const need = (await searchParams).need;
  const perm =
    typeof need === "string" && need in PERMISSIONS ? PERMISSIONS[need as PermissionKey] : null;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <ShieldAlert className="text-burgundy size-10" strokeWidth={1.4} />
      <h1 className="text-3xl">Not available for your role</h1>
      <p className="text-muted-foreground text-sm">
        {perm ? `This needs the “${perm.description}” permission. ` : ""}Ask the owner if you need
        access.
      </p>
      <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
