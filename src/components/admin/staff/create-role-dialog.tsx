"use client";

import { useActionState, useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { createRoleAction } from "@/modules/staff/actions";

export function CreateRoleDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createRoleAction, null);
  const errors = useActionToast(
    state,
    useCallback(() => setOpen(false), []),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus /> New role
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4" noValidate>
          <Field label="Name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" placeholder="e.g. Event lead" className="h-11" />
          </Field>
          <Field label="Start from" htmlFor="copyFromRoleId">
            <NativeSelect id="copyFromRoleId" name="copyFromRoleId" defaultValue="">
              <option value="">No permissions</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  Copy {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="requiresMfa" className="accent-burgundy size-4" />
            Require two-factor authentication
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
