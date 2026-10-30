"use client";

import { useState, useTransition } from "react";
import { Copy, MessageCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aedToFils, formatAED } from "@/lib/money";
import { sendQuoteAction } from "@/modules/bookings/actions";
import { quoteTotals, type QuoteLineInput } from "@/modules/bookings/estimate";
import { waLink, waTexts } from "@/modules/bookings/whatsapp";

type Row = { label: string; qty: string; unit: string };

const toRow = (l: QuoteLineInput): Row => ({
  label: l.label,
  qty: String(l.qty),
  unit: String(l.unitPriceFils / 100),
});

const fils = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? aedToFils(n) : NaN;
};

/** Versioned quote editor: every send creates a new version with its own accept link. */
export function QuoteBuilder({
  bookingId,
  bookingRef,
  customerName,
  customerPhone,
  initialLines,
  depositBp,
  defaultValidUntil,
  minDate,
}: {
  bookingId: string;
  bookingRef: string;
  customerName: string;
  customerPhone: string;
  initialLines: QuoteLineInput[];
  depositBp: number;
  defaultValidUntil: string;
  minDate: string;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialLines.length ? initialLines.map(toRow) : [{ label: "", qty: "1", unit: "0" }],
  );
  const [discount, setDiscount] = useState("0");
  const [deposit, setDeposit] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sent, setSent] = useState<{ version: number; link: string } | null>(null);
  const [pending, start] = useTransition();

  const lines = rows.map((r) => ({
    label: r.label,
    qty: Number(r.qty),
    unitPriceFils: fils(r.unit),
  }));
  const invalidNumber =
    lines.some((l) => !Number.isFinite(l.unitPriceFils)) ||
    !Number.isFinite(fils(discount || "0")) ||
    (deposit.trim() !== "" && !Number.isFinite(fils(deposit)));
  const totals = invalidNumber
    ? null
    : quoteTotals(
        lines,
        fils(discount || "0"),
        deposit.trim() === "" ? null : fils(deposit),
        depositBp,
      );
  const error = invalidNumber ? "Check the amounts (AED, e.g. 1500 or 1500.50)." : totals?.error;

  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function send() {
    if (!totals || error) return;
    start(async () => {
      const r = await sendQuoteAction({
        bookingId,
        lines: totals.lines.map((l) => ({
          label: l.label,
          qty: l.qty,
          unitPriceFils: l.unitPriceFils,
        })),
        discountFils: totals.discountFils,
        depositFils: deposit.trim() === "" ? null : totals.depositFils,
        validUntil,
        notes,
        sendEmail,
      });
      if (r.ok) {
        toast.success(r.message ?? "Quotation sent.");
        setSent({ version: r.data.version, link: r.data.link });
      } else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="text-muted-foreground hidden grid-cols-[1fr_5rem_8rem_7rem_2.5rem] gap-2 text-xs sm:grid">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit (AED)</span>
          <span className="text-end">Line total</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_5rem_8rem_7rem_2.5rem] sm:items-center sm:border-0 sm:p-0"
          >
            <Input
              aria-label={`Line ${i + 1} description`}
              value={r.label}
              onChange={(e) => set(i, { label: e.target.value })}
              className="col-span-2 h-10 sm:col-span-1"
            />
            {/* Phones: the column headings are hidden, so each field says what it is. */}
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-muted-foreground text-xs sm:hidden">Qty</span>
              <Input
                aria-label={`Line ${i + 1} quantity`}
                type="number"
                inputMode="numeric"
                min={1}
                value={r.qty}
                onChange={(e) => set(i, { qty: e.target.value })}
                className="h-10"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-muted-foreground text-xs sm:hidden">Unit (AED)</span>
              <Input
                aria-label={`Line ${i + 1} unit price (AED)`}
                inputMode="decimal"
                value={r.unit}
                onChange={(e) => set(i, { unit: e.target.value })}
                className="h-10"
              />
            </label>
            <span className="numeric text-sm sm:text-end">
              {totals?.lines[i] ? formatAED(totals.lines[i].totalFils) : "—"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setRows((rs) => [...rs, { label: "", qty: "1", unit: "0" }])}
        >
          <Plus /> Add line
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Discount (AED)" htmlFor="q-discount">
          <Input
            id="q-discount"
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="h-10"
          />
        </Field>
        <Field
          label="Deposit (AED)"
          htmlFor="q-deposit"
          hint={`Empty = ${depositBp / 100}% of the total`}
        >
          <Input
            id="q-deposit"
            inputMode="decimal"
            value={deposit}
            placeholder={totals ? String(totals.depositFils / 100) : ""}
            onChange={(e) => setDeposit(e.target.value)}
            className="h-10"
          />
        </Field>
        <Field label="Valid until" htmlFor="q-valid">
          <Input
            id="q-valid"
            type="date"
            min={minDate}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="h-10"
          />
        </Field>
      </div>
      <Field label="Notes for the customer (optional)" htmlFor="q-notes">
        <Textarea id="q-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <dl className="bg-muted/50 numeric grid gap-1 rounded-lg p-4 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{totals ? formatAED(totals.subtotalFils) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Discount</dt>
          <dd>{totals ? `−${formatAED(totals.discountFils)}` : "—"}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd data-testid="quote-builder-total">{totals ? formatAED(totals.totalFils) : "—"}</dd>
        </div>
        <div className="text-muted-foreground flex justify-between">
          <dt>Deposit</dt>
          <dd>{totals ? formatAED(totals.depositFils) : "—"}</dd>
        </div>
      </dl>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="accent-burgundy size-5"
          />
          Email the customer
        </label>
        <Button type="button" onClick={send} disabled={pending || !!error}>
          {pending ? "Sending…" : "Send quotation"}
        </Button>
      </div>

      {sent ? (
        <div className="rounded-lg border p-4 text-sm" role="status">
          <p className="font-medium">Quotation v{sent.version} — accept link</p>
          <p className="text-muted-foreground mt-1 break-all" data-testid="quote-link">
            {sent.link}
          </p>
          <ShareButtons
            link={sent.link}
            whatsapp={waLink(
              customerPhone,
              waTexts.quote(customerName, bookingRef, totals?.totalFils ?? 0, sent.link),
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ShareButtons({ link, whatsapp }: { link: string; whatsapp: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          navigator.clipboard.writeText(link).then(
            () => toast.success("Link copied."),
            () => toast.error("Couldn't copy — select the link instead."),
          )
        }
      >
        <Copy /> Copy link
      </Button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#25D366]/50 px-3 text-[0.8rem] font-medium text-[#1a7f45] hover:bg-[#25D366]/10"
      >
        <MessageCircle className="size-4" /> Share on WhatsApp
      </a>
    </div>
  );
}
