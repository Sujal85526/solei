"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { createClient } from "@/lib/supabase/client";
import {
  createBannerAction,
  deleteBannerAction,
  moveBannerAction,
  replaceBannerImageAction,
  updateBannerAction,
} from "@/modules/banners/actions";
import { MAX_BANNERS, type Banner, type BannerKind } from "@/modules/banners/schema";
import { BANNER_BUCKET } from "@/modules/banners/url";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const SIZE_HINT = {
  desktop: "Wide (landscape), about 2400 × 1350 px",
  mobile: "Tall (portrait), about 1080 × 1920 px",
} as const;

/** Check a picked file and upload it to the banners bucket; returns its path inside the bucket. */
async function uploadPicture(bannerId: string, kind: BannerKind, file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error(`${file.name}: use a JPG, PNG, WebP or AVIF.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 5 MB — compress it first.`);
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  // A new file name every time, so browsers and the CDN never show an old picture.
  const path = `${bannerId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from(BANNER_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export function BannersManager({ banners }: { banners: Banner[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {banners.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
          No banners yet — the homepage shows the standard Solei hero. Add a banner to replace it.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {banners.map((b, i) => (
            <li key={b.id}>
              <BannerCard banner={b} index={i} count={banners.length} />
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button onClick={() => setAdding(true)} disabled={banners.length >= MAX_BANNERS}>
          <Plus /> Add banner
        </Button>
        {banners.length >= MAX_BANNERS ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Up to {MAX_BANNERS} banners. Delete one to add another.
          </p>
        ) : null}
      </div>
      {adding ? <AddBannerDialog onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function BannerCard({ banner, index, count }: { banner: Banner; index: number; count: number }) {
  const [pending, start] = useTransition();
  const [state, formProps, saving] = useFormAction(updateBannerAction, null);
  const e = useActionToast(state);

  const move = (dir: -1 | 1) =>
    start(async () => {
      const r = await moveBannerAction(banner.id, dir);
      if (!r.ok) toast.error(r.error);
    });

  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Banner {index + 1}</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move earlier"
            disabled={pending || index === 0}
            onClick={() => move(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move later"
            disabled={pending || index === count - 1}
            onClick={() => move(1)}
          >
            <ArrowDown />
          </Button>
          <ConfirmButton
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete banner ${index + 1}`}
            title={`Delete banner ${index + 1}?`}
            description="The banner and its pictures are removed from the homepage."
            confirmLabel="Delete"
            destructive
            action={() => deleteBannerAction(banner.id)}
          >
            <Trash2 />
          </ConfirmButton>
        </div>
      </header>

      <div className="grid items-start gap-4 sm:grid-cols-[1fr_9rem]">
        <Picture bannerId={banner.id} kind="desktop" url={banner.desktopUrl} />
        <Picture bannerId={banner.id} kind="mobile" url={banner.mobileUrl} />
      </div>

      <form {...formProps} className="grid gap-4 sm:grid-cols-2" noValidate>
        <input type="hidden" name="id" value={banner.id} />
        {count > 1 ? (
          <Field
            label="Stays for (seconds)"
            htmlFor={`seconds-${banner.id}`}
            error={e.seconds}
            hint="Then the next banner fades in."
          >
            <Input
              id={`seconds-${banner.id}`}
              name="seconds"
              type="number"
              min={2}
              max={60}
              defaultValue={banner.seconds}
              className="h-11"
            />
          </Field>
        ) : (
          <input type="hidden" name="seconds" value={banner.seconds} />
        )}
        <Field
          label="Link (optional)"
          htmlFor={`link-${banner.id}`}
          error={e.linkHref}
          hint="Where a tap on the banner goes, e.g. /shop"
        >
          <Input
            id={`link-${banner.id}`}
            name="linkHref"
            defaultValue={banner.href ?? ""}
            placeholder="/shop"
            className="h-11"
          />
        </Field>
        <Field
          label="Description (for screen readers)"
          htmlFor={`alt-${banner.id}`}
          error={e.alt}
          className="sm:col-span-2"
        >
          <Input
            id={`alt-${banner.id}`}
            name="alt"
            defaultValue={banner.alt}
            placeholder="What the banner shows"
            className="h-11"
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** One picture of a banner with a Replace button. */
function Picture({ bannerId, kind, url }: { bannerId: string; kind: BannerKind; url: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function replace(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadPicture(bannerId, kind, file);
      const r = await replaceBannerImageAction({ id: bannerId, kind, path });
      if (r.ok) toast.success(r.message ?? "Picture replaced.");
      else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{kind === "desktop" ? "Desktop" : "Phone"}</p>
      <div
        className={`bg-muted overflow-hidden rounded-lg border ${
          kind === "desktop" ? "aspect-video" : "aspect-[9/16] max-w-36"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a storage URL */}
        <img src={url} alt={`${kind} banner`} className="size-full object-cover" loading="lazy" />
      </div>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Replace ${kind} picture`}
        onChange={(ev) => replace(ev.target.files?.[0])}
      />
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} Replace
      </Button>
    </div>
  );
}

function AddBannerDialog({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<{ desktop?: File; mobile?: File }>({});
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    if (!files.desktop || !files.mobile) {
      toast.error("Choose both a desktop and a phone picture.");
      return;
    }
    setBusy(true);
    const id = crypto.randomUUID();
    try {
      const [desktopPath, mobilePath] = await Promise.all([
        uploadPicture(id, "desktop", files.desktop),
        uploadPicture(id, "mobile", files.mobile),
      ]);
      const r = await createBannerAction({
        id,
        desktopPath,
        mobilePath,
        seconds: fd.get("seconds"),
        linkHref: fd.get("linkHref"),
        alt: fd.get("alt"),
      });
      if (r.ok) {
        toast.success(r.message ?? "Banner added.");
        onClose();
      } else {
        toast.error(r.error);
        // Don't leave the pictures behind when the banner wasn't saved.
        await createClient().storage.from(BANNER_BUCKET).remove([desktopPath, mobilePath]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add banner</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {(["desktop", "mobile"] as const).map((kind) => (
            <Field
              key={kind}
              label={kind === "desktop" ? "Desktop picture" : "Phone picture"}
              htmlFor={`new-${kind}`}
              hint={SIZE_HINT[kind]}
              required
            >
              <Input
                id={`new-${kind}`}
                type="file"
                accept={TYPES.join(",")}
                className="h-11 pt-2.5"
                onChange={(ev) => setFiles((f) => ({ ...f, [kind]: ev.target.files?.[0] }))}
              />
            </Field>
          ))}
          <Field
            label="Stays for (seconds)"
            htmlFor="new-seconds"
            hint="Used when there's more than one banner."
          >
            <Input
              id="new-seconds"
              name="seconds"
              type="number"
              min={2}
              max={60}
              defaultValue={5}
              className="h-11"
            />
          </Field>
          <Field label="Link (optional)" htmlFor="new-link" hint="e.g. /shop">
            <Input id="new-link" name="linkHref" placeholder="/shop" className="h-11" />
          </Field>
          <Field
            label="Description (for screen readers)"
            htmlFor="new-alt"
            className="sm:col-span-2"
          >
            <Input id="new-alt" name="alt" placeholder="What the banner shows" className="h-11" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Uploading…" : "Add banner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
