"use client";

import { useFormAction } from "@/hooks/use-form-action";

import { useCallback, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { saveLocationAction } from "@/modules/inventory/actions";

type Location = {
  id: string;
  name: string;
  kind: string;
  sells_online: boolean;
  is_default: boolean;
  active: boolean;
};

export function LocationsEditor({
  locations,
  canEdit,
}: {
  locations: Location[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Location | "new" | null>(null);
  const close = useCallback(() => setEditing(null), []);
  return (
    <>
      <ul className="bg-card divide-y rounded-xl border">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {l.name}
                {l.is_default ? <Badge>Main</Badge> : null}
                {l.kind === "event" ? <Badge variant="pink">Event</Badge> : null}
                {l.sells_online ? <Badge variant="success">Sells online</Badge> : null}
                {!l.active ? <Badge variant="muted">Inactive</Badge> : null}
              </p>
            </div>
            {canEdit && l.kind !== "event" ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(l)}
                aria-label={`Edit ${l.name}`}
              >
                <Pencil />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <Button variant="outline" className="mt-4" onClick={() => setEditing("new")}>
          <Plus /> Add location
        </Button>
      ) : null}
      <p className="text-muted-foreground mt-3 text-xs">
        Event locations are created automatically for each event.
      </p>
      {editing ? (
        <LocationDialog
          key={editing === "new" ? "new" : editing.id}
          location={editing === "new" ? undefined : editing}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function LocationDialog({ location, onClose }: { location?: Location; onClose: () => void }) {
  const [state, action, pending] = useFormAction(saveLocationAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location ? `Edit ${location.name}` : "New location"}</DialogTitle>
        </DialogHeader>
        <form {...action} className="flex flex-col gap-4" noValidate>
          {location ? <input type="hidden" name="id" value={location.id} /> : null}
          <Field label="Name" htmlFor="name" error={e.name} required>
            <Input
              id="name"
              name="name"
              defaultValue={location?.name}
              placeholder="Dubai storage"
              className="h-11"
            />
          </Field>
          <Field label="Type" htmlFor="kind">
            <NativeSelect
              id="kind"
              name="kind"
              defaultValue={location?.kind === "other" ? "other" : "warehouse"}
            >
              <option value="warehouse">Warehouse / storage</option>
              <option value="other">Other (e.g. showroom)</option>
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="sellsOnline"
              defaultChecked={location?.sells_online ?? false}
              className="accent-burgundy size-5"
            />
            Website orders can use this stock
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={location?.active ?? true}
              className="accent-burgundy size-5"
            />
            Active
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
