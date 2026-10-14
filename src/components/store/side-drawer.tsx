"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Baby-pink side drawer used on phones (menu, shop filters): glides in from `side` over a dimmed
 * overlay; children marked `.drawer-item` ease in one after another (globals.css "Side drawer").
 * Escape, the overlay or the close button dismiss it. Controlled, so links can close it on tap.
 */
export function SideDrawer({
  open,
  onOpenChange,
  side,
  trigger,
  title,
  header,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "start" | "end";
  /** The button that opens the drawer (rendered as the dialog trigger). */
  trigger: { label: string; icon: ReactNode; className?: string };
  /** Accessible title (also shown when no `header` is given). */
  title: string;
  /** Optional visual header in place of the title (e.g. the logo). */
  header?: ReactNode;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        aria-label={trigger.label}
        title={trigger.label}
        className={trigger.className}
      >
        {trigger.icon}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="side-drawer-backdrop bg-noir/60 fixed inset-0 z-50 backdrop-blur-[2px]" />
        <Dialog.Popup
          data-side={side}
          className={cn(
            "side-drawer on-blush bg-pink text-burgundy fixed inset-y-0 z-50 flex w-[82vw] max-w-xs flex-col px-7 pt-6 pb-8 shadow-2xl shadow-black/40 outline-none",
            side === "start" ? "start-0" : "end-0",
          )}
        >
          <div className="flex items-center justify-between">
            {header ?? (
              <p className="eyebrow text-burgundy text-[0.65rem]" aria-hidden>
                {title}
              </p>
            )}
            <Dialog.Close
              aria-label={closeLabel}
              className="text-burgundy/70 hover:text-burgundy -me-2 flex size-10 items-center justify-center transition-colors"
            >
              <X className="size-5" strokeWidth={1.25} />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
