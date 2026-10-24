"use client";

import { useState } from "react";
import { Ban, Mail, SlidersHorizontal } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatAED } from "@/lib/money";
import {
  adjustGiftCardAction,
  resendGiftCardAction,
  voidGiftCardAction,
} from "@/modules/gift-cards/actions";

/** Resend, adjust the balance and void — beside a gift card (gift_cards.manage). */
export function GiftCardActions({
  id,
  code,
  balanceFils,
  active,
  recipientEmail,
}: {
  id: string;
  code: string;
  balanceFils: number;
  active: boolean;
  recipientEmail: string | null;
}) {
  const [mode, setMode] = useState<"adjust" | "void" | null>(null);
  const close = () => setMode(null);
  if (!active) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {recipientEmail ? (
        <ConfirmButton
          size="sm"
          title={`Email ${code} again?`}
          description={`The gift card goes to ${recipientEmail} again.`}
          confirmLabel="Send"
          action={() => resendGiftCardAction(id)}
        >
          <Mail className="size-4" /> Resend
        </ConfirmButton>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => setMode("adjust")}>
        <SlidersHorizontal className="size-4" /> Adjust balance
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setMode("void")}>
        <Ban className="size-4" /> Void
      </Button>
      {mode === "adjust" ? (
        <AdjustDialog id={id} balanceFils={balanceFils} onClose={close} />
      ) : mode === "void" ? (
        <VoidDialog id={id} code={code} balanceFils={balanceFils} onClose={close} />
      ) : null}
    </div>
  );
}

function Shell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  id,
  balanceFils,
  onClose,
}: {
  id: string;
  balanceFils: number;
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(adjustGiftCardAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Shell
      title="Adjust balance"
      description={`Balance now ${formatAED(balanceFils)}. Use a minus to take money off, e.g. -50.`}
      onClose={onClose}
    >
      <form {...action} className="grid gap-4" noValidate>
        <input type="hidden" name="id" value={id} />
        <Field label="Amount (AED)" htmlFor="adjAmount" error={e.amount} required>
          <Input id="adjAmount" name="amount" inputMode="decimal" className="numeric h-11" />
        </Field>
        <Field label="Reason" htmlFor="adjReason" error={e.reason} required>
          <Input
            id="adjReason"
            name="reason"
            placeholder="e.g. Spent at a pop-up before the till was online"
            className="h-11"
          />
        </Field>
        <DialogFooter>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </Shell>
  );
}

function VoidDialog({
  id,
  code,
  balanceFils,
  onClose,
}: {
  id: string;
  code: string;
  balanceFils: number;
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(voidGiftCardAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Shell
      title={`Void ${code}?`}
      description={`It can't be spent any more${balanceFils > 0 ? ` and its ${formatAED(balanceFils)} balance is written off` : ""}. This can't be undone.`}
      onClose={onClose}
    >
      <form {...action} className="grid gap-4" noValidate>
        <input type="hidden" name="id" value={id} />
        <Field label="Reason" htmlFor="voidReason" error={e.reason} required>
          <Input
            id="voidReason"
            name="reason"
            placeholder="e.g. Issued by mistake"
            className="h-11"
          />
        </Field>
        <DialogFooter>
          <Button type="submit" variant="destructive" size="lg" disabled={pending}>
            {pending ? "Voiding…" : "Void gift card"}
          </Button>
        </DialogFooter>
      </form>
    </Shell>
  );
}
