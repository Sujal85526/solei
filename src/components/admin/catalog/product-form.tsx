"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback } from "react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { saveProductAction } from "@/modules/catalog/actions";

type Option = { id: string; name: string };
export type ProductFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  category_id?: string;
  destination_id?: string | null;
  description?: string | null;
  notes_top?: string[];
  notes_heart?: string[];
  notes_base?: string[];
  active?: boolean;
  featured?: boolean;
  sort?: number;
};

export function ProductForm({
  product,
  categories,
  destinations,
}: {
  product?: ProductFormValues;
  categories: Option[];
  destinations: Option[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProductAction, null);
  const onSaved = useCallback(
    (data: { id: string }) => {
      if (!product?.id) router.push(`/admin/products/${data.id}`);
    },
    [product?.id, router],
  );
  const e = useActionToast(state, onSaved);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Product name"
          htmlFor="name"
          error={e.name}
          required
          className="sm:col-span-2"
        >
          <Input
            id="name"
            name="name"
            defaultValue={product?.name}
            placeholder="Capri Perfume"
            className="h-11"
          />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={e.categoryId} required>
          <NativeSelect
            id="categoryId"
            name="categoryId"
            defaultValue={product?.category_id ?? ""}
            className="[&_select]:h-11"
          >
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Destination"
          htmlFor="destinationId"
          error={e.destinationId}
          hint="Earns this destination's passport stamp."
        >
          <NativeSelect
            id="destinationId"
            name="destinationId"
            defaultValue={product?.destination_id ?? ""}
            className="[&_select]:h-11"
          >
            <option value="">None</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          error={e.description}
          className="sm:col-span-2"
        >
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={product?.description ?? ""}
          />
        </Field>
        <Field label="Top notes" htmlFor="notesTop" hint="Comma separated">
          <Input
            id="notesTop"
            name="notesTop"
            defaultValue={product?.notes_top?.join(", ")}
            className="h-11"
          />
        </Field>
        <Field label="Heart notes" htmlFor="notesHeart" hint="Comma separated">
          <Input
            id="notesHeart"
            name="notesHeart"
            defaultValue={product?.notes_heart?.join(", ")}
            className="h-11"
          />
        </Field>
        <Field label="Base notes" htmlFor="notesBase" hint="Comma separated">
          <Input
            id="notesBase"
            name="notesBase"
            defaultValue={product?.notes_base?.join(", ")}
            className="h-11"
          />
        </Field>
        <Field
          label="URL slug"
          htmlFor="slug"
          error={e.slug}
          hint="Leave empty to generate from the name."
        >
          <Input
            id="slug"
            name="slug"
            defaultValue={product?.slug}
            placeholder="capri-perfume"
            className="h-11"
          />
        </Field>
        <Field label="Sort order" htmlFor="sort" error={e.sort} hint="Lower shows first.">
          <Input
            id="sort"
            name="sort"
            type="number"
            min={0}
            defaultValue={product?.sort ?? 0}
            className="h-11"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product?.active ?? true}
            className="accent-burgundy size-5"
          />
          Visible in the shop
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured ?? false}
            className="accent-burgundy size-5"
          />
          Featured
        </label>
      </div>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : product?.id ? "Save product" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
