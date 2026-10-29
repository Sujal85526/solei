"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { AccountForms } from "@/components/store/account/account-forms";
import { refreshAccount } from "@/components/store/account/use-account";
import { SideDrawer } from "@/components/store/side-drawer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/content/en";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { reviewEligibilityAction, submitReviewAction } from "@/modules/reviews/actions";
import {
  MAX_REVIEW_PHOTO_BYTES,
  MAX_REVIEW_PHOTOS,
  REVIEW_PHOTO_TYPES,
  type ReviewEligibility,
} from "@/modules/reviews/schema";

const r = t.product.reviews;

type Photo = { path: string; preview: string };

/**
 * "Write a review" on the product page: sign in first; then any customer gets the form (stars,
 * text, up to 3 photos uploaded straight to their own storage folder). A popup confirms it was
 * sent; reviews wait for the owner's approval.
 */
export function ReviewComposer({ productId }: { productId: string }) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const load = () => reviewEligibilityAction(productId).then(setEligibility);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!eligibility) return null;
  const note = "text-foreground/70 text-sm leading-relaxed";

  if (eligibility.state === "signed_out") {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="text-primary border-primary/40 hover:border-primary border-b pb-0.5 text-sm transition-colors"
        >
          {r.signIn}
        </button>
        <SideDrawer
          open={signInOpen}
          onOpenChange={setSignInOpen}
          side="end"
          title={r.signInTitle}
          header={<span />}
          closeLabel="Close"
          className="theme-light w-[90vw] max-w-sm overflow-y-auto px-7 sm:px-8"
        >
          <div className="mt-4 pb-4">
            {signInOpen ? (
              <AccountForms
                onSignedIn={async () => {
                  await refreshAccount();
                  setSignInOpen(false);
                  await load();
                }}
              />
            ) : null}
          </div>
        </SideDrawer>
      </>
    );
  }
  if (eligibility.state === "not_purchased") return <p className={note}>{r.notPurchased}</p>;
  if (eligibility.state === "reviewed") {
    return (
      <>
        <p className={note}>{r[eligibility.status]}</p>
        <Dialog open={sent} onOpenChange={setSent}>
          <DialogContent className="theme-light max-w-sm">
            <DialogTitle className="font-display text-primary text-2xl">{r.sentTitle}</DialogTitle>
            <DialogDescription>{r.sentBody}</DialogDescription>
            <DialogFooter>
              <Button type="button" onClick={() => setSent(false)}>
                {r.sentOk}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="cta"
        className="h-10 px-5 text-[0.65rem]"
        onClick={() => setOpen(true)}
      >
        {r.write}
      </Button>
    );
  }
  return (
    <ReviewForm
      productId={productId}
      onCancel={() => setOpen(false)}
      onDone={() => {
        setEligibility({ state: "reviewed", status: "pending" });
        setSent(true);
      }}
    />
  );
}

function ReviewForm({
  productId,
  onCancel,
  onDone,
}: {
  productId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setFormError(null);
    const room = MAX_REVIEW_PHOTOS - photos.length;
    const picked = [...files].slice(0, room);
    for (const f of picked) {
      if (!REVIEW_PHOTO_TYPES.includes(f.type)) return setFormError(r.photoType);
      if (f.size > MAX_REVIEW_PHOTO_BYTES) return setFormError(r.photoTooBig);
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("signed out");
      for (const f of picked) {
        const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
        const path = `${data.user.id}/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("reviews")
          .upload(path, f, { contentType: f.type, cacheControl: "31536000" });
        if (error) throw error;
        setPhotos((p) => [...p, { path, preview: URL.createObjectURL(f) }]);
      }
    } catch {
      setFormError(r.uploadFailed);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startSubmit(async () => {
      const res = await submitReviewAction({
        productId,
        rating,
        body,
        photos: photos.map((p) => p.path),
      });
      if (res.ok) return onDone();
      setErrors(res.fieldErrors ?? {});
      setFormError(res.fieldErrors ? null : res.error);
    });
  }

  const label = "text-muted-foreground font-sans text-[0.65rem] tracking-[0.25em] uppercase";
  const shown = hover || rating;

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-xl flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className={label}>{r.rating}</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className="cursor-pointer" onMouseEnter={() => setHover(i)}>
              <input
                type="radio"
                name="rating"
                value={i}
                checked={rating === i}
                onChange={() => setRating(i)}
                className="peer sr-only"
              />
              <span className="sr-only">
                {i} star{i === 1 ? "" : "s"}
              </span>
              <Star
                aria-hidden
                strokeWidth={1.25}
                className={cn(
                  "text-primary peer-focus-visible:ring-primary/40 size-7 rounded-sm transition-colors peer-focus-visible:ring-2",
                  i <= shown ? "fill-current" : "fill-transparent",
                )}
              />
            </label>
          ))}
        </div>
        {errors.rating ? <p className="text-destructive text-xs">{errors.rating}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="review-body" className={label}>
          {r.body}
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={r.bodyPlaceholder}
          aria-invalid={errors.body ? true : undefined}
          className="border-primary/25 focus-visible:border-primary bg-background/60 w-full border px-4 py-3 text-sm leading-relaxed outline-none"
        />
        {errors.body ? <p className="text-destructive text-xs">{errors.body}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>{r.photos}</span>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.path} className="relative size-20">
              <Image
                src={p.preview}
                alt=""
                fill
                unoptimized
                sizes="80px"
                className="rounded-sm object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotos((all) => all.filter((x) => x.path !== p.path))}
                aria-label={r.removePhoto}
                className="bg-background text-foreground absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full border shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_REVIEW_PHOTOS ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="border-primary/30 text-primary hover:border-primary flex size-20 flex-col items-center justify-center gap-1 rounded-sm border border-dashed text-[0.65rem] transition-colors"
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImagePlus className="size-5" strokeWidth={1.25} />
              )}
              {r.addPhoto}
            </button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={REVIEW_PHOTO_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => addPhotos(e.target.files)}
        />
      </div>

      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
      <div className="flex items-center gap-5">
        <Button type="submit" size="cta" disabled={pending || uploading}>
          {pending ? r.submitting : r.submit}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-primary text-xs underline underline-offset-4"
        >
          {r.cancel}
        </button>
      </div>
    </form>
  );
}
