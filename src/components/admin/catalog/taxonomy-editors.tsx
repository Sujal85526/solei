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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { saveCategoryAction, saveDestinationAction } from "@/modules/catalog/actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sort: number;
};
type Destination = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  region: string | null;
  mood: string | null;
  story: string | null;
  accent_colour: string | null;
  postcard_image_url: string | null;
  hero_image_url: string | null;
  active: boolean;
  sort: number;
};

function useEditor<T>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return { editing, open: setEditing, close: useCallback(() => setEditing(null), []) };
}

export function CategoriesEditor({ categories }: { categories: Category[] }) {
  const { editing, open, close } = useEditor<Category>();
  return (
    <>
      <ul className="bg-card divide-y rounded-xl border">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {c.name} {!c.active ? <Badge variant="muted">Hidden</Badge> : null}
              </p>
              <p className="text-muted-foreground truncate text-sm">{c.description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => open(c)}
              aria-label={`Edit ${c.name}`}
            >
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4" onClick={() => open("new")}>
        <Plus /> Add category
      </Button>
      {editing ? (
        <CategoryDialog
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? undefined : editing}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function CategoryDialog({ category, onClose }: { category?: Category; onClose: () => void }) {
  const [state, action, pending] = useFormAction(saveCategoryAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? `Edit ${category.name}` : "New category"}</DialogTitle>
        </DialogHeader>
        <form {...action} className="flex flex-col gap-4" noValidate>
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <Field label="Name" htmlFor="name" error={e.name} required>
            <Input id="name" name="name" defaultValue={category?.name} className="h-11" />
          </Field>
          <Field label="Description" htmlFor="description" error={e.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={category?.description ?? ""}
              rows={3}
            />
          </Field>
          <Field label="Sort order" htmlFor="sort" error={e.sort}>
            <Input
              id="sort"
              name="sort"
              type="number"
              min={0}
              defaultValue={category?.sort ?? 0}
              className="h-11"
            />
          </Field>
          {category ? <input type="hidden" name="slug" value={category.slug} /> : null}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={category?.active ?? true}
              className="accent-burgundy size-5"
            />
            Visible in the shop
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

export function DestinationsEditor({ destinations }: { destinations: Destination[] }) {
  const { editing, open, close } = useEditor<Destination>();
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {destinations.map((d) => (
          <li key={d.id} className="bg-card overflow-hidden rounded-xl border">
            <div className="bg-muted relative aspect-[16/10]">
              {d.postcard_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview
                <img
                  src={d.postcard_image_url}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <span
                className="absolute start-3 top-3 size-4 rounded-full border-2 border-white"
                style={{ background: d.accent_colour ?? "#460328" }}
              />
            </div>
            <div className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {d.name} {!d.active ? <Badge variant="muted">Hidden</Badge> : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {[d.region, d.country].filter(Boolean).join(", ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => open(d)}
                aria-label={`Edit ${d.name}`}
              >
                <Pencil />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4" onClick={() => open("new")}>
        <Plus /> Add destination
      </Button>
      {editing ? (
        <DestinationDialog
          key={editing === "new" ? "new" : editing.id}
          destination={editing === "new" ? undefined : editing}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function DestinationDialog({
  destination: d,
  onClose,
}: {
  destination?: Destination;
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(saveDestinationAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{d ? `Edit ${d.name}` : "New destination"}</DialogTitle>
        </DialogHeader>
        <form {...action} className="grid gap-4 sm:grid-cols-2" noValidate>
          {d ? <input type="hidden" name="id" value={d.id} /> : null}
          {d ? <input type="hidden" name="slug" value={d.slug} /> : null}
          <Field label="Name" htmlFor="name" error={e.name} required>
            <Input id="name" name="name" defaultValue={d?.name} className="h-11" />
          </Field>
          <Field
            label="Accent colour"
            htmlFor="accentColour"
            error={e.accentColour}
            hint="Hex, e.g. #C9A227"
          >
            <Input
              id="accentColour"
              name="accentColour"
              defaultValue={d?.accent_colour ?? ""}
              className="h-11 font-mono"
            />
          </Field>
          <Field label="Region" htmlFor="region" error={e.region}>
            <Input
              id="region"
              name="region"
              defaultValue={d?.region ?? ""}
              placeholder="Amalfi Coast"
              className="h-11"
            />
          </Field>
          <Field label="Country" htmlFor="country" error={e.country}>
            <Input id="country" name="country" defaultValue={d?.country ?? ""} className="h-11" />
          </Field>
          <Field label="Mood (one line)" htmlFor="mood" error={e.mood} className="sm:col-span-2">
            <Input id="mood" name="mood" defaultValue={d?.mood ?? ""} className="h-11" />
          </Field>
          <Field label="Story" htmlFor="story" error={e.story} className="sm:col-span-2">
            <Textarea id="story" name="story" defaultValue={d?.story ?? ""} rows={4} />
          </Field>
          <Field label="Postcard image URL" htmlFor="postcardImageUrl" error={e.postcardImageUrl}>
            <Input
              id="postcardImageUrl"
              name="postcardImageUrl"
              defaultValue={d?.postcard_image_url ?? ""}
              className="h-11"
            />
          </Field>
          <Field label="Hero image URL" htmlFor="heroImageUrl" error={e.heroImageUrl}>
            <Input
              id="heroImageUrl"
              name="heroImageUrl"
              defaultValue={d?.hero_image_url ?? ""}
              className="h-11"
            />
          </Field>
          <Field label="Sort order" htmlFor="sort" error={e.sort}>
            <Input
              id="sort"
              name="sort"
              type="number"
              min={0}
              defaultValue={d?.sort ?? 0}
              className="h-11"
            />
          </Field>
          <label className="flex items-center gap-3 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={d?.active ?? true}
              className="accent-burgundy size-5"
            />
            Visible in the shop
          </label>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
