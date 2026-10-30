"use client";

import { useRef } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { assignStaffAction, removeStaffAction } from "@/modules/events/actions";

type Assignment = {
  id: string;
  user_id: string;
  name: string;
  position: string | null;
  role: string | null;
};
type Person = { user_id: string; full_name: string; position: string | null; active: boolean };

export function EventStaff({
  eventId,
  assigned,
  people,
  canManage,
}: {
  eventId: string;
  assigned: Assignment[];
  people: Person[];
  canManage: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useFormAction(assignStaffAction, null);
  const e = useActionToast(state, () => form.current?.reset());
  const taken = new Set(assigned.map((a) => a.user_id));
  const available = people.filter((p) => p.active && !taken.has(p.user_id));

  return (
    <div className="flex flex-col gap-5">
      {assigned.length ? (
        <ul className="divide-y rounded-lg border" data-testid="event-staff">
          {assigned.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
              <span
                className="bg-pink-wash text-burgundy flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                aria-hidden
              >
                {a.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {[a.role, a.position].filter(Boolean).join(" · ") || "Team"}
                </p>
              </div>
              {canManage ? (
                <ConfirmButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${a.name}`}
                  title={`Remove ${a.name} from this event?`}
                  confirmLabel="Remove"
                  destructive
                  action={removeStaffAction.bind(null, a.id)}
                >
                  <UserMinus />
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No one is assigned yet.</p>
      )}

      {canManage ? (
        <form
          ref={form}
          {...action}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <Field label="Team member" htmlFor="userId" error={e.userId}>
            <NativeSelect id="userId" name="userId" defaultValue="" className="[&_button]:h-11">
              <option value="" disabled>
                {available.length ? "Choose…" : "Everyone is assigned"}
              </option>
              {available.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name}
                  {p.position ? ` — ${p.position}` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Role at the event" htmlFor="role" error={e.role}>
            <Input id="role" name="role" placeholder="e.g. Booth lead" className="h-11" />
          </Field>
          <Button type="submit" size="lg" className="h-11" disabled={pending || !available.length}>
            <UserPlus /> {pending ? "Adding…" : "Assign"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
