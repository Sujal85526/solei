"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/**
 * A button that asks for confirmation, runs a server action and toasts the result. The dialog
 * closes once the action succeeds (and stays open on an error, which is toasted).
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "Confirm",
  action,
  variant = "outline",
  size,
  destructive,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  action: () => Promise<ActionResult<unknown>>;
  variant?: "outline" | "ghost" | "destructive" | "default";
  size?: "sm" | "default" | "icon-sm";
  destructive?: boolean;
  "aria-label"?: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant={variant} size={size} disabled={pending} aria-label={ariaLabel} />}
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await action();
                if (r.ok) {
                  toast.success(r.message ?? "Done");
                  setOpen(false);
                } else toast.error(r.error);
              })
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
