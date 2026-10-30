"use client";

import { useCallback, useMemo, useState } from "react";
import { PackageCheck, PackagePlus, RotateCcw, Search } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { allocateStockAction, closeEventAction, reopenEventAction } from "@/modules/events/actions";
import type { EventStockRow } from "@/modules/events/queries";
import { DEFAULT_BREAKAGE_REASON } from "@/modules/events/schema";

type Option = { id: string; label: string; sku: string; available: number };
type Warehouse = { id: string; name: string; is_default: boolean };

const COLS = [
  { key: "allocated", label: "Allocated", short: "Alloc." },
  { key: "sold", label: "Sold", short: "Sold" },
  { key: "returned", label: "Returned", short: "Ret." },
  { key: "damaged", label: "Broken", short: "Broken" },
  { key: "remaining", label: "At event", short: "Left" },
] as const;

export function EventStock({
  eventId,
  rows,
  options,
  mainName,
  warehouses,
  closedAt,
  cancelled,
  can,
}: {
  eventId: string;
  rows: EventStockRow[];
  options: Option[];
  mainName: string;
  warehouses: Warehouse[];
  closedAt: string | null;
  cancelled: boolean;
  can: { allocate: boolean; close: boolean; reopen: boolean };
}) {
  const [dialog, setDialog] = useState<"allocate" | "close" | null>(null);
  const close = useCallback(() => setDialog(null), []);
  const totals = Object.fromEntries(
    COLS.map((c) => [c.key, rows.reduce((s, r) => s + r[c.key], 0)]),
  ) as Record<(typeof COLS)[number]["key"], number>;
  const remainingRows = rows.filter((r) => r.remaining > 0);

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-5 gap-1.5 sm:gap-2" data-testid="stock-totals">
        {COLS.map((c) => (
          <div
            key={c.key}
            className={cn(
              "bg-muted/50 rounded-lg px-2 py-2 text-center sm:p-3 sm:text-start",
              c.key === "remaining" && "bg-pink-wash",
            )}
          >
            <dt className="text-muted-foreground text-[0.65rem] sm:text-xs">
              <span className="sm:hidden">{c.short}</span>
              <span className="hidden sm:inline">{c.label}</span>
            </dt>
            <dd className="numeric text-lg font-semibold sm:text-xl" data-testid={`total-${c.key}`}>
              {totals[c.key]}
            </dd>
          </div>
        ))}
      </dl>

      {closedAt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#B9C7B4] bg-[#E6ECE2] p-3 text-sm text-[#3E5238]">
          <PackageCheck className="size-5" aria-hidden />
          <span className="flex-1">
            Closed{" "}
            {formatBusinessDate(closedAt, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            — remaining stock was returned.
          </span>
          {can.reopen ? (
            <ConfirmButton
              size="sm"
              title="Reopen this event?"
              description="Use this to fix a mistake. Stock moves already made stay in the ledger."
              confirmLabel="Reopen"
              action={reopenEventAction.bind(null, eventId)}
            >
              <RotateCcw /> Reopen
            </ConfirmButton>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {can.allocate && !cancelled ? (
            <Button size="lg" className="h-11" onClick={() => setDialog("allocate")}>
              <PackagePlus /> Allocate stock
            </Button>
          ) : null}
          {can.close ? (
            <Button size="lg" variant="outline" className="h-11" onClick={() => setDialog("close")}>
              <PackageCheck /> Close event
            </Button>
          ) : null}
        </div>
      )}

      {rows.length ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm" data-testid="event-stock-table">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  Product
                </th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className="px-1.5 py-2 text-end font-medium sm:px-3">
                    <span className="sm:hidden">{c.short}</span>
                    <span className="hidden sm:inline">{c.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.variantId} data-variant={r.variantId}>
                  <th scope="row" className="px-3 py-2.5 text-start font-normal">
                    <span className="block font-medium">{r.label}</span>
                    <span className="text-muted-foreground text-xs">{r.sku}</span>
                  </th>
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      data-col={c.key}
                      className={cn(
                        "numeric px-1.5 py-2.5 text-end sm:px-3",
                        c.key === "remaining" && "font-semibold",
                        r[c.key] === 0 && "text-muted-foreground/60",
                      )}
                    >
                      {r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No stock at this event yet. Allocate what you&apos;re taking from {mainName}.
        </p>
      )}

      {dialog === "allocate" ? (
        <AllocateDialog eventId={eventId} options={options} mainName={mainName} onClose={close} />
      ) : null}
      {dialog === "close" ? (
        <CloseDialog
          eventId={eventId}
          rows={remainingRows}
          warehouses={warehouses}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function AllocateDialog({
  eventId,
  options,
  mainName,
  onClose,
}: {
  eventId: string;
  options: Option[];
  mainName: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(allocateStockAction, null);
  useActionToast(state, onClose);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      options.filter(
        (o) => !q || o.label.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q),
      ),
    [options, q],
  );
  const units = Object.values(qty).reduce(
    (s, v) => s + (Number(v) > 0 ? Math.floor(Number(v)) : 0),
    0,
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate stock</DialogTitle>
          <DialogDescription>Moves units from {mainName} to this event.</DialogDescription>
        </DialogHeader>
        <form {...action} noValidate className="flex min-h-0 flex-1 flex-col gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          <div className="relative">
            <Search
              className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search products"
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 ps-9"
            />
          </div>
          <ul className="-mx-1 min-h-0 flex-1 divide-y overflow-y-auto px-1">
            {options.map((o) => {
              const over = Number(qty[o.id] ?? 0) > o.available;
              return (
                <li
                  key={o.id}
                  className={cn("flex items-center gap-3 py-2", !visible.includes(o) && "hidden")}
                >
                  <label htmlFor={`qty-${o.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.label}</span>
                    <span
                      className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}
                    >
                      {o.available} available · {o.sku}
                    </span>
                  </label>
                  <Input
                    id={`qty-${o.id}`}
                    name={`qty:${o.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={o.available}
                    step={1}
                    placeholder="0"
                    value={qty[o.id] ?? ""}
                    onChange={(e) => setQty((p) => ({ ...p, [o.id]: e.target.value }))}
                    aria-invalid={over || undefined}
                    className="numeric h-11 w-20 text-end"
                  />
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending || units === 0}>
              {pending
                ? "Allocating…"
                : units
                  ? `Allocate ${units} unit${units === 1 ? "" : "s"}`
                  : "Allocate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({
  eventId,
  rows,
  warehouses,
  onClose,
}: {
  eventId: string;
  rows: EventStockRow[];
  warehouses: Warehouse[];
  onClose: () => void;
}) {
  const [state, action, pending] = useFormAction(closeEventAction, null);
  useActionToast(state, onClose);
  const [returning, setReturning] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.variantId, String(r.remaining)])),
  );
  const parsed = (id: string) => {
    const n = Number(returning[id]);
    return Number.isInteger(n) && returning[id] !== "" ? n : NaN;
  };
  const totalBack = rows.reduce((s, r) => s + (parsed(r.variantId) || 0), 0);
  const totalBroken = rows.reduce((s, r) => {
    const n = parsed(r.variantId);
    return s + (Number.isNaN(n) ? 0 : Math.max(0, r.remaining - n));
  }, 0);
  const invalid = rows.some((r) => {
    const n = parsed(r.variantId);
    return Number.isNaN(n) || n < 0 || n > r.remaining;
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Close event</DialogTitle>
          <DialogDescription>
            Count what&apos;s coming back. Anything not returned is recorded as broken.
          </DialogDescription>
        </DialogHeader>
        <form {...action} noValidate className="flex min-h-0 flex-1 flex-col gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          {rows.length ? (
            <ul
              className="-mx-1 min-h-0 flex-1 divide-y overflow-y-auto px-1"
              data-testid="close-rows"
            >
              {rows.map((r) => {
                const n = parsed(r.variantId);
                const broken = Number.isNaN(n) ? 0 : r.remaining - n;
                const bad = Number.isNaN(n) || n < 0 || n > r.remaining;
                return (
                  <li key={r.variantId} className="flex flex-col gap-2 py-3">
                    <div className="flex items-center gap-3">
                      <label htmlFor={`ret-${r.variantId}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.label}</span>
                        <span className="text-muted-foreground text-xs">
                          Sold {r.sold} · {r.remaining} left at the event
                        </span>
                      </label>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-[0.65rem] uppercase">
                          Returning
                        </span>
                        <Input
                          id={`ret-${r.variantId}`}
                          name={`returning:${r.variantId}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={r.remaining}
                          step={1}
                          value={returning[r.variantId] ?? ""}
                          onChange={(e) =>
                            setReturning((p) => ({ ...p, [r.variantId]: e.target.value }))
                          }
                          aria-invalid={bad || undefined}
                          aria-label={`Returning ${r.label}`}
                          className="numeric h-11 w-20 text-end"
                        />
                      </div>
                    </div>
                    {bad ? (
                      <p className="text-destructive text-xs">Enter 0–{r.remaining}.</p>
                    ) : broken > 0 ? (
                      <div className="flex items-center gap-2 rounded-md bg-[#B4690E]/5 p-2">
                        <span className="shrink-0 text-xs font-medium text-[#8A5108]">
                          {broken} broken
                        </span>
                        <Input
                          name={`reason:${r.variantId}`}
                          aria-label={`Breakage reason for ${r.label}`}
                          placeholder={DEFAULT_BREAKAGE_REASON}
                          className="h-9 text-sm"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nothing left at the event — closing just marks it completed.
            </p>
          )}
          {warehouses.length > 1 ? (
            <Field label="Return to" htmlFor="toLocationId">
              <NativeSelect
                id="toLocationId"
                name="toLocationId"
                defaultValue={warehouses.find((w) => w.is_default)?.id}
                className="[&_button]:h-11"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-muted-foreground text-xs sm:me-auto" data-testid="close-summary">
              {totalBack} back to stock{totalBroken ? ` · ${totalBroken} broken` : ""}
            </p>
            <Button type="submit" size="lg" disabled={pending || invalid}>
              {pending ? "Closing…" : "Close event & return stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
