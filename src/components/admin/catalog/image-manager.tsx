"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  addProductImageAction,
  deleteImageAction,
  reorderImagesAction,
  updateImageAltAction,
} from "@/modules/catalog/actions";

type Img = { id: string; url: string; alt: string };

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function ImageManager({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: Img[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        if (!TYPES.includes(file.type)) {
          toast.error(`${file.name}: use JPG, PNG, WebP or AVIF.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is over 5 MB.`);
          continue;
        }
        const ext =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type,
        });
        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          continue;
        }
        const r = await addProductImageAction({
          productId,
          storagePath: `products/${path}`,
          alt: productName,
        });
        if (!r.ok) toast.error(r.error);
      }
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const ids = images.map((i) => i.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    start(async () => {
      const r = await reorderImagesAction(productId, ids);
      if (!r.ok) toast.error(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className="bg-background overflow-hidden rounded-lg border">
            <div className="bg-muted relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary storage URLs */}
              <img src={img.url} alt={img.alt} className="size-full object-cover" loading="lazy" />
              {i === 0 ? (
                <span className="bg-burgundy text-cream absolute start-2 top-2 rounded px-1.5 py-0.5 text-[0.65rem]">
                  Cover
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 p-2">
              <Input
                aria-label="Image description"
                defaultValue={img.alt}
                className="h-9 text-xs"
                onBlur={(e) => {
                  if (e.target.value !== img.alt)
                    start(async () => {
                      const r = await updateImageAltAction(img.id, e.target.value);
                      if (!r.ok) toast.error(r.error);
                    });
                }}
              />
              <div className="flex justify-between">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move earlier"
                  >
                    <ArrowUp className="rtl:rotate-0" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending || i === images.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move later"
                  >
                    <ArrowDown />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label="Remove image"
                  onClick={() =>
                    start(async () => {
                      const r = await deleteImageAction(img.id);
                      if (r.ok) toast.success(r.message ?? "Removed");
                      else toast.error(r.error);
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="text-muted-foreground hover:border-burgundy hover:text-burgundy flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <ImagePlus className="size-6" strokeWidth={1.5} />
            )}
            {uploading ? "Uploading…" : "Add photos"}
          </button>
        </li>
      </ul>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
        data-testid="image-upload"
      />
      <p className="text-muted-foreground text-xs">
        JPG, PNG, WebP or AVIF up to 5 MB. The first image is the cover.
      </p>
    </div>
  );
}
