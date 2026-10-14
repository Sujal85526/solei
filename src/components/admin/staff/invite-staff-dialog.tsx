"use client";

import { useFormAction } from "@/hooks/use-form-action";

import { useCallback, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActionToast } from "@/hooks/use-action-toast";
import { inviteStaffAction } from "@/modules/staff/actions";
import { StaffFormFields, type RoleOption } from "./staff-form-fields";

export function InviteStaffDialog({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(inviteStaffAction, null);
  const errors = useActionToast(
    state,
    useCallback(() => setOpen(false), []),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus /> Invite staff
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email to set their password.
          </DialogDescription>
        </DialogHeader>
        <form {...action} className="flex flex-col gap-6" noValidate>
          <StaffFormFields roles={roles} errors={errors} includeEmail />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending invitation…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
