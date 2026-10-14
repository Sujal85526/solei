"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Button } from "@/components/ui/button";
import { formatBusinessDate } from "@/lib/dates";
import { addDocumentAction, deleteDocumentAction } from "@/modules/events/actions";
import { EVENT_DOC_TYPES } from "@/modules/events/schema";
import { formatBytes, uploadEventFile } from "./upload";

type Doc = {
  id: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  url: string | null;
};

export function EventDocuments({
  eventId,
  documents,
  canManage,
}: {
  eventId: string;
  documents: Doc[];
  canManage: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const r = await uploadEventFile(eventId, "docs", file, EVENT_DOC_TYPES);
        if (!r.ok) {
          toast.error(r.error);
          continue;
        }
        const res = await addDocumentAction({
          eventId,
          name: file.name.slice(0, 200),
          storagePath: r.path,
          mime: file.type,
          sizeBytes: file.size,
        });
        if (res.ok) toast.success(`${file.name} uploaded.`);
        else toast.error(res.error);
      }
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {documents.length ? (
        <ul className="divide-y rounded-lg border" data-testid="document-list">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="text-burgundy size-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatBusinessDate(d.created_at, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {d.size_bytes ? ` · ${formatBytes(d.size_bytes)}` : ""}
                </p>
              </div>
              {d.url ? (
                <a
                  href={d.url}
                  aria-label={`Download ${d.name}`}
                  className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
                >
                  <Download className="size-4" />
                </a>
              ) : null}
              {canManage ? (
                <ConfirmButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${d.name}`}
                  title={`Delete ${d.name}?`}
                  confirmLabel="Delete"
                  destructive
                  action={deleteDocumentAction.bind(null, d.id)}
                >
                  <Trash2 />
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No documents yet — contracts, floor plans, permits.
        </p>
      )}
      {canManage ? (
        <div>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading ? "Uploading…" : "Upload documents"}
          </Button>
          <p className="text-muted-foreground mt-2 text-xs">
            PDF, images, Word, Excel or text up to 10 MB.
          </p>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept={EVENT_DOC_TYPES.join(",")}
            data-testid="document-upload"
            onChange={(ev) => upload(ev.target.files)}
          />
        </div>
      ) : null}
    </div>
  );
}
