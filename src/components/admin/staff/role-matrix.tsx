"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { deleteRoleAction, setRolePermissionsAction } from "@/modules/staff/actions";

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  requires_mfa: boolean;
  is_system: boolean;
  permissions: string[];
  staffCount: number;
};

const groups = PERMISSION_KEYS.reduce<Record<string, PermissionKey[]>>((acc, k) => {
  (acc[PERMISSIONS[k].group] ??= []).push(k);
  return acc;
}, {});

export function RoleMatrix({ roles }: { roles: Role[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {roles.map((role) => (
        <RoleCard key={role.id} role={role} />
      ))}
    </div>
  );
}

function RoleCard({ role }: { role: Role }) {
  const locked = role.key === "owner";
  const initial = useMemo(
    () => new Set(locked ? PERMISSION_KEYS : role.permissions),
    [locked, role.permissions],
  );
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [pending, start] = useTransition();
  const dirty = selected.size !== initial.size || [...selected].some((k) => !initial.has(k));

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = () =>
    start(async () => {
      const r = await setRolePermissionsAction(role.id, [...selected]);
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error);
    });

  const remove = () =>
    start(async () => {
      const r = await deleteRoleAction(role.id);
      if (r.ok) toast.success(r.message ?? "Deleted");
      else toast.error(r.error);
    });

  return (
    <section aria-labelledby={`role-${role.id}`} className="bg-card rounded-xl border">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h2
            id={`role-${role.id}`}
            className="text-foreground flex items-center gap-2 font-sans text-lg font-semibold"
          >
            {role.name}
            {role.requires_mfa ? (
              <Badge variant="pink">
                <ShieldCheck /> 2FA
              </Badge>
            ) : null}
          </h2>
          <p className="text-muted-foreground text-sm">
            {role.description ?? "Custom role"} · {role.staffCount} active
          </p>
        </div>
        <div className="flex gap-2">
          {!role.is_system ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={remove}
              disabled={pending}
              aria-label={`Delete ${role.name}`}
            >
              <Trash2 />
            </Button>
          ) : null}
          {locked ? (
            <Badge variant="muted">
              <Lock /> All permissions
            </Badge>
          ) : (
            <Button size="sm" onClick={save} disabled={!dirty || pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </header>
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        {Object.entries(groups).map(([group, keys]) => (
          <fieldset key={group} disabled={locked || pending}>
            <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              {group}
            </legend>
            <ul className="flex flex-col gap-1">
              {keys.map((key) => {
                const id = `${role.id}-${key}`;
                return (
                  <li key={key}>
                    <label
                      htmlFor={id}
                      className={cn(
                        "hover:bg-muted flex min-h-10 cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-sm",
                        locked && "cursor-default",
                      )}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggle(key)}
                        className="accent-burgundy mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        {PERMISSIONS[key].description}
                        {key === "reports.financial.view" ? (
                          <span className="text-muted-foreground block text-xs">
                            Costs, COGS, expenses and profit
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
