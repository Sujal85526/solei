"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import type { AdminOccasion } from "@/modules/giveaways/admin-queries";
import { saveOccasionAction } from "@/modules/giveaways/actions";
import { uploadCatalogPhoto } from "./upload-photo";

/** Giveaway occasions (Wedding, Graduation, Ramadan, Eid …): photo tiles on the Giveaways page. */
export function OccasionsEditor({ occasions }: { occasions: AdminOccasion[] }) {
  const [editing, setEditing] = useState<AdminOccasion | "new" | null>(null);
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {occasions.map((o) => (
          <li key={o.id} className="bg-card overflow-hidden rounded-xl border">
            <div className="bg-muted relative aspect-[16/10]">
              {o.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview
                <img src={o.image_url} alt="" className="size-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {o.name} {!o.active ? <Badge variant="muted">Hidden</Badge> : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">{o.blurb}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(o)}
                aria-label={`Edit ${o.name}`}
              >
                <Pencil />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4" onClick={() => setEditing("new")}>
        <Plus /> Add occasion
      </Button>
      {editing ? (
        <OccasionDialog
          key={editing === "new" ? "new" : editing.id}
          occasion={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function OccasionDialog({
  occasion: o,
  onClose,
}: {
  occasion?: AdminOccasion;
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(saveOccasionAction, null);
  const e = useActionToast(state, onClose);
  const [image, setImage] = useState({ url: o?.image_url ?? "", path: o?.storage_path ?? "" });
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const res = await uploadCatalogPhoto(file, "occasions");
    setUploading(false);
    if ("error" in res) toast.error(res.error);
    else setImage({ url: res.url, path: res.path });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{o ? `Edit ${o.name}` : "New occasion"}</DialogTitle>
        </DialogHeader>
        <form {...action} className="flex flex-col gap-4" noValidate>
          {o ? <input type="hidden" name="id" value={o.id} /> : null}
          <input type="hidden" name="imageUrl" value={image.url} />
          <input type="hidden" name="storagePath" value={image.path} />
          <Field label="Name" htmlFor="name" error={e.name} required>
            <Input id="name" name="name" defaultValue={o?.name} className="h-11" />
          </Field>
          <Field label="Short text" htmlFor="blurb" error={e.blurb} hint="One or two lines.">
            <Textarea id="blurb" name="blurb" defaultValue={o?.blurb ?? ""} rows={2} />
          </Field>
          <Field label="Photo" htmlFor="occasionPhoto" error={e.imageUrl ?? e.storagePath}>
            <div className="flex items-center gap-3">
              <span className="bg-muted relative block aspect-[4/5] w-24 overflow-hidden rounded border">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview
                  <img src={image.url} alt="" className="size-full object-cover" />
                ) : null}
              </span>
              <label className="hover:bg-muted inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                {image.url ? "Change photo" : "Upload photo"}
                <input
                  id="occasionPhoto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(ev) => void upload(ev.target.files?.[0])}
                />
              </label>
            </div>
          </Field>
          <Field label="Sort order" htmlFor="sort" error={e.sort}>
            <Input
              id="sort"
              name="sort"
              type="number"
              min={0}
              defaultValue={o?.sort ?? 0}
              className="h-11"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={o?.active ?? true}
              className="accent-burgundy size-5"
            />
            Visible on the Giveaways page
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending || uploading}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
