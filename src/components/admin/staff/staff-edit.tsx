"use client";

import { useFormAction } from "@/hooks/use-form-action";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  sendPasswordResetAction,
  setStaffActiveAction,
  updateStaffAction,
} from "@/modules/staff/actions";
import { StaffFormFields, type RoleOption } from "./staff-form-fields";

type Staff = {
  user_id: string;
  full_name: string;
  role_id: string;
  position: string | null;
  phone: string | null;
  employment_status: string;
  active: boolean;
};

export function StaffEditForm({
  staff,
  roles,
  isSelf,
}: {
  staff: Staff;
  roles: RoleOption[];
  isSelf: boolean;
}) {
  const [state, action, pending] = useFormAction(updateStaffAction, null);
  const errors = useActionToast(state);
  return (
    <form {...action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="userId" value={staff.user_id} />
      <StaffFormFields
        roles={roles}
        errors={errors}
        defaults={{
          fullName: staff.full_name,
          roleId: staff.role_id,
          position: staff.position,
          phone: staff.phone,
          employmentStatus: staff.employment_status,
        }}
      />
      {isSelf ? (
        <p className="text-muted-foreground text-xs">You can&apos;t change your own role.</p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function StaffAccessActions({ staff, isSelf }: { staff: Staff; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error ?? "Failed");
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run(() => sendPasswordResetAction(staff.user_id))}
      >
        Send password reset
      </Button>
      {isSelf ? null : staff.active ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>
            Deactivate
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {staff.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access immediately and can&apos;t sign in. Their history stays in orders
                and the activity log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => run(() => setStaffActiveAction(staff.user_id, false))}
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          disabled={pending}
          onClick={() => run(() => setStaffActiveAction(staff.user_id, true))}
        >
          Reactivate
        </Button>
      )}
    </div>
  );
}
