"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { accountCopy as c } from "@/content/account";
import type { ActionResult } from "@/lib/action-result";
import { formatPhone } from "@/lib/phone";
import { saveAddressAction, saveProfileAction, signOutAction } from "@/modules/account/actions";
import type { SavedAddress } from "@/modules/account/schema";
import { EmirateSelect, type ZoneOption } from "./emirate-select";
import { TextField } from "./text-field";
import { refreshAccount } from "./use-account";

function useSave(action: (input: unknown) => Promise<ActionResult>) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(e.currentTarget));
    setErrors({});
    setStatus(null);
    start(async () => {
      const res = await action(input);
      if (res.ok) {
        setStatus(c.page.saved);
        await refreshAccount();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) setStatus(res.error);
      }
    });
  };
  return { errors, status, pending, onSubmit };
}

function SaveRow({ pending, status }: { pending: boolean; status: string | null }) {
  return (
    <div className="col-span-2 flex items-center gap-4">
      <Button type="submit" variant="outline" disabled={pending} className="h-11 px-6">
        {c.page.save}
      </Button>
      {status ? (
        <p role="status" className="text-muted-foreground text-xs">
          {status}
        </p>
      ) : null}
    </div>
  );
}

const grid = "mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-5";

export function ProfileForm({
  initial,
}: {
  initial: { firstName: string; lastName: string; phone: string };
}) {
  const { errors, status, pending, onSubmit } = useSave(saveProfileAction);
  return (
    <form noValidate onSubmit={onSubmit} className={grid}>
      <TextField
        label={c.signUp.firstName}
        name="firstName"
        autoComplete="given-name"
        defaultValue={initial.firstName}
        error={errors.firstName}
      />
      <TextField
        label={c.signUp.lastName}
        name="lastName"
        autoComplete="family-name"
        defaultValue={initial.lastName}
        error={errors.lastName}
      />
      <TextField
        label={c.signUp.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={initial.phone ? formatPhone(initial.phone) : ""}
        error={errors.phone}
        className="col-span-2"
      />
      <SaveRow pending={pending} status={status} />
    </form>
  );
}

export function AddressForm({
  initial,
  zones,
}: {
  initial: SavedAddress | null;
  zones: ZoneOption[];
}) {
  const { errors, status, pending, onSubmit } = useSave(saveAddressAction);
  return (
    <form noValidate onSubmit={onSubmit} className={grid}>
      {!initial ? (
        <p className="text-muted-foreground col-span-2 -mt-2 text-sm">{c.page.noAddress}</p>
      ) : null}
      <AddressFields initial={initial} zones={zones} errors={errors} />
      <SaveRow pending={pending} status={status} />
    </form>
  );
}

/** Street, apartment, area, city and emirate — shared by the account page and checkout. */
export function AddressFields({
  initial,
  zones,
  errors,
  emirate,
  onEmirateChange,
}: {
  initial: Partial<SavedAddress> | null;
  zones: ZoneOption[];
  errors: Record<string, string>;
  /** Controlled emirate (checkout, where it drives the delivery fee). */
  emirate?: string;
  onEmirateChange?: (value: string) => void;
}) {
  return (
    <>
      <EmirateSelect
        zones={zones}
        error={errors.emirate}
        defaultValue={initial?.emirate ?? ""}
        value={emirate}
        onChange={onEmirateChange}
        className="col-span-2"
      />
      <TextField
        label="Street address"
        name="line1"
        autoComplete="address-line1"
        placeholder="Street, building or villa"
        defaultValue={initial?.line1 ?? ""}
        error={errors.line1}
        className="col-span-2"
      />
      <TextField
        label="Apartment, floor (optional)"
        name="line2"
        autoComplete="address-line2"
        defaultValue={initial?.line2 ?? ""}
        error={errors.line2}
        className="col-span-2"
      />
      <TextField
        label="Area"
        name="area"
        autoComplete="address-level3"
        defaultValue={initial?.area ?? ""}
        error={errors.area}
      />
      <TextField
        label="City"
        name="city"
        autoComplete="address-level2"
        defaultValue={initial?.city ?? ""}
        error={errors.city}
      />
    </>
  );
}

export function SignOutLink() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOutAction();
          await refreshAccount();
          router.push("/");
          router.refresh();
        })
      }
      className="text-muted-foreground hover:text-primary text-[0.7rem] tracking-[0.2em] uppercase underline-offset-4 hover:underline"
    >
      {c.menu.signOut}
    </button>
  );
}
