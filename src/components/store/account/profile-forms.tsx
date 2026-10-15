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
import { PhoneField } from "./phone-field";
import { TextField } from "./text-field";
import { refreshAccount } from "./use-account";

function useSave(action: (input: unknown) => Promise<ActionResult>, onSaved?: () => void) {
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
        onSaved?.();
      } else {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) setStatus(res.error);
      }
    });
  };
  return { errors, status, pending, onSubmit };
}

function SaveRow({
  pending,
  status,
  onCancel,
}: {
  pending: boolean;
  status: string | null;
  onCancel?: () => void;
}) {
  return (
    <div className="col-span-2 flex items-center gap-4">
      <Button type="submit" disabled={pending} className="h-9 px-5 text-xs">
        {c.page.save}
      </Button>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-primary text-xs"
        >
          {c.page.cancel}
        </button>
      ) : null}
      {status ? (
        <p role="status" className="text-muted-foreground text-xs">
          {status}
        </p>
      ) : null}
    </div>
  );
}

const grid = "mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-4";

export function ProfileForm({
  initial,
  onDone,
}: {
  initial: { firstName: string; lastName: string; phone: string };
  onDone?: () => void;
}) {
  const { errors, status, pending, onSubmit } = useSave(saveProfileAction, onDone);
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
      <PhoneField
        label={c.signUp.phone}
        defaultValue={initial.phone}
        error={errors.phone}
        className="col-span-2"
      />
      <SaveRow pending={pending} status={status} onCancel={onDone} />
    </form>
  );
}

export function AddressForm({
  initial,
  zones,
  onDone,
}: {
  initial: SavedAddress | null;
  zones: ZoneOption[];
  onDone?: () => void;
}) {
  const { errors, status, pending, onSubmit } = useSave(saveAddressAction, onDone);
  return (
    <form noValidate onSubmit={onSubmit} className={grid}>
      <AddressFields initial={initial} zones={zones} errors={errors} />
      <SaveRow pending={pending} status={status} onCancel={onDone} />
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
      className="text-muted-foreground hover:text-primary text-[0.62rem] tracking-[0.2em] uppercase underline-offset-4 hover:underline"
    >
      {c.menu.signOut}
    </button>
  );
}

/** A compact account row: label, a one-line summary and Edit, which opens the form in place. */
export function EditableRow({
  label,
  summary,
  children,
}: {
  label: string;
  summary: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="border-border border-b py-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-muted-foreground font-sans text-[0.6rem] tracking-[0.25em] uppercase">
          {label}
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-primary text-xs underline-offset-4 hover:underline"
          >
            {c.page.edit}
          </button>
        ) : null}
      </div>
      {editing ? children(() => setEditing(false)) : <div className="mt-2 text-sm">{summary}</div>}
    </div>
  );
}

/** Details and saved address as two compact rows, each editable in place. */
export function AccountDetails({
  profile,
  address,
  zones,
}: {
  profile: { firstName: string; lastName: string; phone: string };
  address: SavedAddress | null;
  zones: ZoneOption[];
}) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const zone = zones.find((z) => z.emirate === address?.emirate)?.name;
  return (
    <>
      <EditableRow
        label={c.page.details}
        summary={
          <p>
            {name || "—"}
            {profile.phone ? (
              <span className="text-muted-foreground"> · {formatPhone(profile.phone)}</span>
            ) : null}
          </p>
        }
      >
        {(close) => <ProfileForm initial={profile} onDone={close} />}
      </EditableRow>
      <EditableRow
        label={c.page.address}
        summary={
          address ? (
            <p>
              {[address.line1, address.line2, address.area, address.city, zone]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : (
            <p className="text-muted-foreground">{c.page.noAddress}</p>
          )
        }
      >
        {(close) => <AddressForm initial={address} zones={zones} onDone={close} />}
      </EditableRow>
    </>
  );
}
