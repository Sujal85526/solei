"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";
import { saveBannerAction } from "@/modules/promotions/actions";
import type { Banner, BannerPlacement } from "@/modules/promotions/schema";
import { uploadBannerImage } from "./upload-banner-image";

const PLACEMENTS: { placement: BannerPlacement; label: string; hint: string }[] = [
  {
    placement: "announcement",
    label: "Announcement bar",
    hint: "One short line above the site header on every page",
  },
  {
    placement: "homepage",
    label: "Homepage banner",
    hint: "A card under the big homepage photo, with an optional title and image",
  },
];

/** Create or edit a banner (announcement bar line or homepage card). */
export function BannerForm({
  banner,
  placement: initialPlacement,
}: {
  banner?: Banner;
  placement?: BannerPlacement;
}) {
  const [state, action, pending] = useFormAction(saveBannerAction, null);
  const e = useActionToast(state);
  const [placement, setPlacement] = useState<BannerPlacement>(
    banner?.placement ?? initialPlacement ?? "announcement",
  );
  const [image, setImage] = useState({
    url: banner?.imageUrl ?? "",
    path: banner?.imagePath ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [limitDates, setLimitDates] = useState(Boolean(banner?.startsOn || banner?.endsOn));
  const homepage = placement === "homepage";

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const res = await uploadBannerImage(file);
    setUploading(false);
    if ("error" in res) toast.error(res.error);
    else setImage({ url: res.url, path: res.path });
  }

  return (
    <form {...action} noValidate className="flex flex-col gap-6">
      {banner ? <input type="hidden" name="id" value={banner.id} /> : null}
      <input type="hidden" name="placement" value={placement} />
      {homepage ? (
        <>
          <input type="hidden" name="imageUrl" value={image.url} />
          <input type="hidden" name="imagePath" value={image.path} />
        </>
      ) : null}

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <h2 className="font-sans text-base font-medium">Banner</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            Where it shows <span className="text-destructive">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLACEMENTS.map((p) => (
              <label
                key={p.placement}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
                  placement === p.placement ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  checked={placement === p.placement}
                  onChange={() => setPlacement(p.placement)}
                  className="accent-primary mt-0.5"
                />
                <span>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground block text-xs">{p.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {homepage ? (
          <Field
            label="Title"
            htmlFor="title"
            error={e.title}
            hint="Optional big line, e.g. “The Ramadan edit”"
          >
            <Input
              id="title"
              name="title"
              defaultValue={banner?.title ?? ""}
              maxLength={80}
              className="h-11"
            />
          </Field>
        ) : null}

        <Field
          label={homepage ? "Text" : "Message"}
          htmlFor="body"
          error={e.body}
          hint={
            homepage
              ? "One or two sentences under the title"
              : "Keep it short so it fits on a phone, e.g. “Free delivery in Abu Dhabi this week”"
          }
          required
        >
          {homepage ? (
            <Textarea
              id="body"
              name="body"
              rows={3}
              maxLength={200}
              defaultValue={banner?.body ?? ""}
            />
          ) : (
            <Input
              id="body"
              name="body"
              maxLength={200}
              defaultValue={banner?.body ?? ""}
              className="h-11"
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Link"
            htmlFor="linkUrl"
            error={e.linkUrl}
            hint="Optional. A page of the site, e.g. /shop, or a full https:// address"
          >
            <Input
              id="linkUrl"
              name="linkUrl"
              inputMode="url"
              autoCapitalize="none"
              autoComplete="off"
              defaultValue={banner?.linkUrl ?? ""}
              className="h-11"
            />
          </Field>
          <Field
            label="Link text"
            htmlFor="linkLabel"
            error={e.linkLabel}
            hint="Optional words for the link, e.g. Shop now"
          >
            <Input
              id="linkLabel"
              name="linkLabel"
              maxLength={40}
              defaultValue={banner?.linkLabel ?? ""}
              className="h-11"
            />
          </Field>
        </div>

        {homepage ? (
          <Field
            label="Image"
            htmlFor="bannerImage"
            error={e.imageUrl ?? e.imagePath}
            hint="Optional. JPG, PNG, WebP or AVIF, up to 5 MB; a wide photo works best"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-muted relative block aspect-[16/9] w-40 overflow-hidden rounded border">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview
                  <img src={image.url} alt="" className="size-full object-cover" />
                ) : null}
              </span>
              <label className="hover:bg-muted inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                {image.url ? "Change image" : "Upload image"}
                <input
                  id="bannerImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(ev) => {
                    void upload(ev.target.files?.[0]);
                    ev.target.value = "";
                  }}
                />
              </label>
              {image.url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setImage({ url: "", path: "" })}
                >
                  <X /> Remove
                </Button>
              ) : null}
            </div>
          </Field>
        ) : null}
      </section>

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <h2 className="font-sans text-base font-medium">When</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={limitDates}
              onChange={(ev) => setLimitDates(ev.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Only between certain dates
              <span className="text-muted-foreground block text-xs">
                Otherwise it shows from now until you hide or delete it.
              </span>
            </span>
          </label>
          {limitDates ? (
            <div className="grid gap-5 rounded-lg border p-4 sm:grid-cols-2">
              <Field
                label="Starts on"
                htmlFor="startsOn"
                error={e.startsOn}
                hint="From 00:00 UAE time — leave empty to start now"
              >
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  defaultValue={banner?.startsOn ?? ""}
                  className="h-11"
                />
              </Field>
              <Field
                label="Ends on"
                htmlFor="endsOn"
                error={e.endsOn}
                hint="Until 23:59 UAE time — leave empty for no end"
              >
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  defaultValue={banner?.endsOn ?? ""}
                  className="h-11"
                />
              </Field>
            </div>
          ) : null}
        </div>

        <Field
          label="Order"
          htmlFor="sort"
          error={e.sort}
          hint="Lower first — when several banners show in the same place"
          className="max-w-48"
        >
          <Input
            id="sort"
            name="sort"
            inputMode="numeric"
            defaultValue={banner?.sort ?? 0}
            className="h-11"
          />
        </Field>
      </section>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={banner?.active ?? true}
          className="accent-primary size-4"
        />
        Showing — on the website within its dates
      </label>

      <Button type="submit" size="lg" disabled={pending || uploading} className="self-start">
        {pending ? "Saving…" : banner ? "Save changes" : "Create banner"}
      </Button>
    </form>
  );
}
