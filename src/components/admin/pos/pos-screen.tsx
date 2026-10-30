"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Check,
  ChevronRight,
  CloudOff,
  Gift,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Split,
  X,
} from "lucide-react";
import {
  GiveawayPicker,
  type StaffGiveawayLine,
} from "@/components/admin/giveaways/giveaway-picker";
import { TillPromotionsPanel, useTillPromotions } from "@/components/admin/pos/till-promotions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { checkGiftCardAtTillAction } from "@/modules/gift-cards/actions";
import { giftCardApplies, giftCardRefusalMessage, maskGiftCode } from "@/modules/gift-cards/schema";
import { daySummaryAction } from "@/modules/pos/actions";
import type { StoreGiveaway } from "@/modules/giveaways/types";
import type { DaySummary, PosEvent, PosProduct } from "@/modules/pos/queries";
import type { PointsReward } from "@/modules/promotions/schema";
import { queue, send, type QueuedSale } from "@/modules/pos/queue";
import {
  balanceSplit,
  cartTotal,
  POS_METHOD_LABELS,
  POS_METHODS,
  type PosMethod,
  type PosPaymentMethod,
} from "@/modules/pos/schema";

type CartLine = { variantId: string; qty: number };
type SplitRow = { method: PosMethod; amount: string };
type Done = { label: string; offline: boolean } | null;
type SalePayment = { method: PosPaymentMethod; amountFils: number; reference?: string };
/** A checked gift card: how much of it this sale takes. */
type TillGift = { code: string; balanceFils: number; appliedFils: number };

const LAST_EVENT_KEY = "solei.pos.lastEvent";

export function PosScreen({
  events,
  eventId,
  products: initialProducts,
  summary: initialSummary,
  giftCards,
  giveaways = [],
  rewards = [],
}: {
  events: PosEvent[];
  eventId: string;
  products: PosProduct[];
  summary: DaySummary;
  /** The owner lets the till take gift cards (Admin → Gift cards → Settings). */
  giftCards: boolean;
  /** Giveaways staff can sell with their choices (Products → a product → Giveaway). */
  giveaways?: StoreGiveaway[];
  /** Points rewards customers can take at the till (Admin → Loyalty → Points & tiers). */
  rewards?: PointsReward[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [summary, setSummary] = useState(initialSummary);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [giveawayLines, setGiveawayLines] = useState<StaffGiveawayLine[]>([]);
  const [giveawayOpen, setGiveawayOpen] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // A payment tapped while the price is being checked: runs once the price is back, if unchanged.
  const [queuedTap, setQueuedTap] = useState<{
    method: (typeof POS_METHODS)[number];
    totalFils: number;
  } | null>(null);
  const [priceChanged, setPriceChanged] = useState(false);
  const [split, setSplit] = useState<SplitRow[] | null>(null);
  // Gift card: null = not in use; "entering" = typing the code; else the checked card.
  const [gift, setGift] = useState<TillGift | "entering" | null>(null);
  const [giftCode, setGiftCode] = useState("");
  const [giftError, setGiftError] = useState<string | null>(null);
  const [checkingGift, setCheckingGift] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failed, setFailed] = useState<QueuedSale[]>([]);
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  const byId = useMemo(() => new Map(products.map((p) => [p.variantId, p])), [products]);
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  );
  const lines = cart
    .map((l) => ({ ...l, product: byId.get(l.variantId)! }))
    .filter((l) => l.product);
  const listTotal = cartTotal([
    ...lines.map((l) => ({ priceFils: l.product.priceFils, qty: l.qty })),
    ...giveawayLines.map((l) => ({ priceFils: l.unitFils, qty: l.qty })),
  ]);
  const saleLines = useMemo(
    () => [
      ...cart
        .filter((l) => byId.has(l.variantId))
        .map((l) => ({ variantId: l.variantId, qty: l.qty })),
      ...giveawayLines.map((l) => ({
        variantId: l.variantId,
        qty: l.qty,
        options: l.options,
        giveawayId: l.giveawayId,
      })),
    ],
    [cart, byId, giveawayLines],
  );
  // Sale prices, offers, codes and points from the database (catalogue prices offline).
  const promo = useTillPromotions({ eventId, lines: saleLines, online, phone, email, rewards });
  // What the payments must add up to: after offers, codes, rewards and points.
  const total = promo.dueFils ?? listTotal;
  const items = lines.reduce((s, l) => s + l.qty, 0) + giveawayLines.reduce((s, l) => s + l.qty, 0);
  const qtyOf = (id: string) => cart.find((l) => l.variantId === id)?.qty ?? 0;

  const refreshQueue = useCallback(async () => {
    const all = await queue.all().catch(() => [] as QueuedSale[]);
    setPendingCount(all.filter((s) => !s.error).length);
    setFailed(all.filter((s) => s.error));
  }, []);

  const flush = useCallback(async () => {
    const all = await queue.all().catch(() => [] as QueuedSale[]);
    let sentAny = false;
    for (const sale of all.filter((s) => !s.error)) {
      const r = await send(sale);
      if (r.status === "offline") break;
      if (r.status === "sent") sentAny = true;
    }
    await refreshQueue();
    if (sentAny)
      daySummaryAction(eventId)
        .then(setSummary)
        .catch(() => {});
  }, [eventId, refreshQueue]);

  // Remember this device's event: when several run today, reopen on the one in use, not the first.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LAST_EVENT_KEY);
      localStorage.setItem(
        LAST_EVENT_KEY,
        new URLSearchParams(window.location.search).has("event") ? eventId : (saved ?? eventId),
      );
    } catch {
      return; // no storage (private window): the first event of today stays selected
    }
    const chosen = new URLSearchParams(window.location.search).has("event");
    if (!chosen && saved && saved !== eventId && events.some((e) => e.id === saved && e.today)) {
      router.replace(`/admin/pos?event=${saved}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    const kick = window.setTimeout(flush, 0);
    window.addEventListener("online", flush);
    const id = window.setInterval(flush, 30_000);
    return () => {
      window.clearTimeout(kick);
      window.removeEventListener("online", flush);
      window.clearInterval(id);
    };
  }, [flush]);

  const add = (id: string) =>
    setCart((prev) => {
      const found = prev.find((l) => l.variantId === id);
      return found
        ? prev.map((l) => (l.variantId === id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { variantId: id, qty: 1 }];
    });
  const setQty = (id: string, qty: number) =>
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== id)
        : prev.map((l) => (l.variantId === id ? { ...l, qty } : l)),
    );

  async function checkGift() {
    setCheckingGift(true);
    setGiftError(null);
    const res = await checkGiftCardAtTillAction(giftCode);
    setCheckingGift(false);
    if (!res.ok) return setGiftError(res.error);
    if (!res.data.ok) return setGiftError(giftCardRefusalMessage(res.data.reason));
    setGift({
      code: res.data.code,
      balanceFils: res.data.balanceFils,
      appliedFils: giftCardApplies(res.data.balanceFils, total),
    });
  }

  function resetGift() {
    setGift(null);
    setGiftCode("");
    setGiftError(null);
  }

  async function complete(payments: SalePayment[]) {
    if (!items || busy || promo.pending) return;
    setBusy(true);
    const extras = promo.saleExtras();
    const sale: QueuedSale = {
      clientUuid: crypto.randomUUID(),
      eventId,
      soldAt: new Date().toISOString(),
      customerPhone: phone.trim() || undefined,
      customerEmail: email.trim() || undefined,
      customerName: name.trim() || undefined,
      lines: [...saleLines, ...extras.rewardLines],
      couponCodes: extras.couponCodes,
      points: extras.points,
      applyOffers: extras.applyOffers,
      payments,
      totalFils: promo.totalFils ?? total,
      attempts: 0,
    };
    await queue.put(sale); // durable first — never lose a sale
    const r = await send(sale);
    // Optimistic stock at this event.
    setProducts((prev) =>
      prev.map((p) => {
        const q = sale.lines
          .filter((l) => l.variantId === p.variantId)
          .reduce((s, l) => s + l.qty, 0);
        return q ? { ...p, stock: p.stock - q } : p;
      }),
    );
    if (r.status === "sent") {
      setDone({ label: `${r.number} · ${formatAED(total)}`, offline: false });
      daySummaryAction(eventId)
        .then(setSummary)
        .catch(() => {});
    } else if (r.status === "offline") {
      setDone({ label: `Saved offline · ${formatAED(total)}`, offline: true });
    } else {
      setDone(null);
      alert(`Sale not recorded: ${r.error}`);
    }
    await refreshQueue();
    setCart([]);
    setGiveawayLines([]);
    promo.reset();
    setName("");
    setPhone("");
    setEmail("");
    setPriceChanged(false);
    setSplit(null);
    resetGift();
    setPayOpen(false);
    setCartOpen(false);
    setBusy(false);
    window.setTimeout(() => setDone(null), 2200);
  }

  useEffect(() => {
    if (!queuedTap || promo.pending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the price check just came back
    setQueuedTap(null);
    if (!payOpen) return;
    if (total === queuedTap.totalFils) {
      void complete([{ method: queuedTap.method, amountFils: total }]);
    } else {
      setPriceChanged(true); // never charge a price the cashier hasn't seen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedTap, promo.pending]);

  const splitValid = (() => {
    if (!split) return false;
    const amounts = split.map((r) => Math.round(Number(r.amount || 0) * 100));
    return amounts.every((a) => a > 0) && amounts.reduce((s, a) => s + a, 0) === total;
  })();

  const shown = products.filter((p) => category === "all" || p.category === category);
  const event = events.find((e) => e.id === eventId);
  const eventItems = events.map((e) => ({
    value: e.id,
    label: `${e.today ? "● " : ""}${e.name}${e.closed ? " (closed)" : ""}`,
  }));

  return (
    <div className={cn("flex flex-col gap-4", items ? "pb-60 lg:pb-44" : "pb-40 lg:pb-28")}>
      {/* Top bar: event, sync, today */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={eventItems}
          value={eventId}
          onValueChange={(id) => {
            if (id) router.push(`/admin/pos?event=${id}`);
          }}
        >
          <SelectTrigger
            aria-label="Event"
            className="bg-card dark:bg-card dark:hover:bg-card min-w-0 flex-1 rounded-md text-base font-medium data-[size=default]:h-12"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {eventItems.map((e) => (
              <SelectItem key={e.value} value={e.value} className="min-h-11 text-base">
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={flush}
          className={cn(
            "inline-flex h-12 items-center gap-2 rounded-lg border px-3 text-sm",
            !online || pendingCount
              ? "border-[#B4690E]/50 bg-[#B4690E]/10 text-[#8A5108]"
              : "text-muted-foreground",
          )}
          aria-label="Sync sales now"
        >
          {online ? <RefreshCw className="size-4" /> : <CloudOff className="size-4" />}
          {pendingCount ? `${pendingCount} waiting to sync` : online ? "Synced" : "Offline"}
        </button>
      </div>
      {event?.closed ? (
        <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          This event is closed. Reopen it in the calendar to sell.
        </p>
      ) : null}
      {failed.length ? (
        <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-sm">
          <p className="text-destructive font-medium">
            {failed.length} sale(s) couldn&apos;t be recorded
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {failed.map((f) => (
              <li key={f.clientUuid} className="flex items-center justify-between gap-2">
                <span>
                  {formatAED(f.totalFils)} — {f.error}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => queue.remove(f.clientUuid).then(refreshQueue)}
                >
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="bg-card grid grid-cols-3 gap-2 rounded-xl border p-3 text-center">
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-wider uppercase">
            Sales today
          </p>
          <p className="numeric text-xl font-semibold">{summary.orders}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-wider uppercase">Units</p>
          <p className="numeric text-xl font-semibold">{summary.units}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-wider uppercase">Revenue</p>
          <p className="numeric text-xl font-semibold">{formatAED(summary.revenue_fils)}</p>
        </div>
        {Object.keys(summary.by_method).length ? (
          <div className="col-span-3 flex flex-wrap justify-center gap-1.5 border-t pt-2">
            {Object.entries(summary.by_method).map(([m, amount]) => (
              <span key={m} className="numeric bg-muted rounded-full px-2.5 py-0.5 text-xs">
                {POS_METHOD_LABELS[m as PosPaymentMethod] ?? m} {formatAED(amount)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Category chips */}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Category"
      >
        {["all", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-sm",
              category === c ? "border-burgundy bg-burgundy text-cream" : "bg-card",
            )}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
        {giveaways.length ? (
          <button
            type="button"
            onClick={() => setGiveawayOpen(true)}
            className="bg-card h-10 shrink-0 rounded-full border border-dashed px-4 text-sm"
          >
            <Gift className="me-1.5 inline size-4" /> Giveaway
          </button>
        ) : null}
      </div>
      <GiveawayPicker
        giveaways={giveaways}
        stockOf={(id) => byId.get(id)?.stock ?? 0}
        open={giveawayOpen}
        onOpenChange={setGiveawayOpen}
        onAdd={(line) =>
          setGiveawayLines((prev) =>
            prev.some((l) => l.key === line.key)
              ? prev.map((l) => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l))
              : [...prev, line],
          )
        }
      />

      {/* Product tiles */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => {
          const q = qtyOf(p.variantId);
          const left = p.stock - q;
          return (
            <li key={p.variantId} className="relative">
              <button
                type="button"
                onClick={() => add(p.variantId)}
                disabled={event?.closed}
                className={cn(
                  "bg-card relative flex w-full flex-col overflow-hidden rounded-xl border text-start transition-transform active:scale-[0.97]",
                  q ? "border-burgundy ring-burgundy ring-2" : "",
                )}
                aria-label={`Add ${p.name}${p.label ? ` ${p.label}` : ""}, ${formatAED(p.priceFils)}, ${left} left`}
              >
                <span className="bg-muted relative aspect-square w-full">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small tiles; works offline from cache
                    <img src={p.image} alt="" className="size-full object-cover" loading="lazy" />
                  ) : null}
                  {q ? (
                    <span className="numeric bg-burgundy text-cream absolute end-2 top-2 flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                      {q}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-col gap-0.5 p-3">
                  <span className="font-display text-burgundy text-xl leading-tight [overflow-wrap:anywhere]">
                    {p.destination ?? p.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {p.category}
                    {p.label ? ` · ${p.label}` : ""}
                  </span>
                  <span className="mt-1 flex items-center justify-between">
                    <span className="numeric font-semibold">{formatAED(p.priceFils)}</span>
                    <span
                      className={cn(
                        "numeric text-xs",
                        left <= 0 ? "text-destructive font-medium" : "text-muted-foreground",
                      )}
                    >
                      {left} left
                    </span>
                  </span>
                </span>
              </button>
              {/* Undo a mis-tap without opening the cart. */}
              {q && !event?.closed ? (
                <button
                  type="button"
                  onClick={() => setQty(p.variantId, q - 1)}
                  aria-label={`One less ${p.destination ?? p.name}`}
                  className="bg-cream text-burgundy border-burgundy/30 absolute start-2 top-2 flex size-10 items-center justify-center rounded-full border shadow-sm active:scale-95"
                >
                  <Minus className="size-4" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Sticky cart bar */}
      <div className="bg-card/95 fixed inset-x-0 bottom-16 z-20 border-t p-3 backdrop-blur lg:start-64 lg:bottom-0">
        {/* The order, always in view: fix a mis-tap with − / + without opening anything. */}
        {items ? (
          <ul aria-label="Order" className="mx-auto mb-3 flex max-w-5xl gap-2 overflow-x-auto pb-1">
            {lines.map((l) => (
              <li
                key={l.variantId}
                className="bg-background flex shrink-0 items-center gap-1 rounded-full border py-1 ps-4 pe-1"
              >
                <span className="me-1 text-sm font-medium">
                  {l.product.destination ?? l.product.name}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`One less ${l.product.destination ?? l.product.name}`}
                  onClick={() => setQty(l.variantId, l.qty - 1)}
                >
                  <Minus />
                </Button>
                <span className="numeric w-6 text-center font-semibold">{l.qty}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`One more ${l.product.destination ?? l.product.name}`}
                  onClick={() => setQty(l.variantId, l.qty + 1)}
                >
                  <Plus />
                </Button>
              </li>
            ))}
            {giveawayLines.map((l) => (
              <li
                key={l.key}
                className="bg-background flex shrink-0 items-center gap-1 rounded-full border py-1 ps-4 pe-1"
              >
                <span className="me-1 max-w-[60vw] truncate text-sm font-medium sm:max-w-80">
                  {l.qty} × {l.title}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`Remove ${l.title}`}
                  onClick={() => setGiveawayLines((prev) => prev.filter((x) => x.key !== l.key))}
                >
                  <X />
                </Button>
              </li>
            ))}
            <li className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                className="h-11 rounded-full"
                onClick={() => {
                  setCart([]);
                  setGiveawayLines([]);
                }}
              >
                <X /> Clear all
              </Button>
            </li>
          </ul>
        ) : null}
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            disabled={!items}
            className="flex h-14 flex-1 items-center gap-3 rounded-xl border px-4 text-start disabled:opacity-50"
          >
            <ShoppingBag className="size-5" />
            <span className="flex-1">
              <span className="block text-sm font-medium">
                {items ? `${items} item${items === 1 ? "" : "s"}` : "Tap a product"}
              </span>
              <span className="numeric text-muted-foreground block text-xs">
                {formatAED(total)}
              </span>
            </span>
            {items ? (
              <span className="text-burgundy hidden items-center gap-1 text-sm font-medium whitespace-nowrap sm:flex">
                View & edit <ChevronRight className="size-4" />
              </span>
            ) : null}
          </button>
          <Button
            size="xl"
            className="h-14 min-w-36"
            disabled={!items || event?.closed}
            onClick={() => setPayOpen(true)}
          >
            Charge {formatAED(total)}
          </Button>
        </div>
      </div>

      {/* Cart editor */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cart</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col divide-y">
            {lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {l.product.destination ?? l.product.name}
                  </span>
                  <span className="numeric text-muted-foreground text-sm">
                    {formatAED(l.product.priceFils * l.qty)}
                  </span>
                </span>
                <Button
                  size="icon-lg"
                  variant="outline"
                  aria-label="One less"
                  onClick={() => setQty(l.variantId, l.qty - 1)}
                >
                  <Minus />
                </Button>
                <span className="numeric w-6 text-center text-lg font-semibold">{l.qty}</span>
                <Button
                  size="icon-lg"
                  variant="outline"
                  aria-label="One more"
                  onClick={() => setQty(l.variantId, l.qty + 1)}
                >
                  <Plus />
                </Button>
              </li>
            ))}
            {giveawayLines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {l.qty} × {l.title}
                  </span>
                  {l.detail ? (
                    <span className="text-muted-foreground block text-xs">{l.detail}</span>
                  ) : null}
                  <span className="numeric text-muted-foreground text-sm">
                    {formatAED(l.unitFils * l.qty)}
                  </span>
                </span>
                <Button
                  size="icon-lg"
                  variant="outline"
                  aria-label={`Remove ${l.title}`}
                  onClick={() => setGiveawayLines((prev) => prev.filter((x) => x.key !== l.key))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            onClick={() => {
              setCart([]);
              setGiveawayLines([]);
            }}
          >
            <X /> Clear cart
          </Button>
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
          if (!o) {
            setSplit(null);
            resetGift();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="numeric text-4xl">{formatAED(total)}</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Selling at <span className="text-foreground font-medium">{event?.name}</span>
            </p>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Customer for Passport</legend>
            <p className="text-muted-foreground -mt-1 text-xs">
              Optional — with an email their stamps also show in their online account. You can add
              this to the order later too.
            </p>
            <Input
              autoComplete="off"
              aria-label="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="h-12 text-base"
            />
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              aria-label="Customer email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email — name@example.com"
              className="h-12 text-base"
            />
            <Input
              type="tel"
              inputMode="tel"
              aria-label="Customer mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile — 050 123 4567"
              className="h-12 text-base"
            />
          </fieldset>
          <TillPromotionsPanel promo={promo} rewards={rewards} online={online} />
          {promo.pending ? (
            <p role="status" className="text-muted-foreground text-sm">
              Updating the price…
            </p>
          ) : priceChanged ? (
            <p role="status" className="text-destructive text-sm">
              The price changed for this customer. Check it, then tap the payment again.
            </p>
          ) : null}
          {gift === "entering" ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void checkGift();
              }}
            >
              <Input
                autoFocus
                aria-label="Gift card code"
                autoCapitalize="characters"
                autoComplete="off"
                value={giftCode}
                onChange={(e) => setGiftCode(e.target.value)}
                placeholder="Gift card code — XXXX-XXXX-XXXX"
                className="h-12 font-mono text-base uppercase"
              />
              {giftError ? (
                <p role="alert" className="text-destructive text-sm">
                  {giftError}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="ghost" size="xl" onClick={resetGift}>
                  Back
                </Button>
                <Button type="submit" size="xl" disabled={checkingGift || !giftCode.trim()}>
                  {checkingGift ? "Checking…" : "Check card"}
                </Button>
              </div>
            </form>
          ) : gift ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="flex items-center gap-2">
                  <Gift className="text-primary size-4" />
                  <span className="font-mono">{maskGiftCode(gift.code)}</span>
                  <span className="text-muted-foreground">
                    balance {formatAED(gift.balanceFils)}
                  </span>
                </span>
                <span className="numeric font-semibold">−{formatAED(gift.appliedFils)}</span>
              </div>
              {total - gift.appliedFils === 0 ? (
                <Button
                  size="xl"
                  disabled={busy || promo.pending}
                  onClick={() =>
                    complete([
                      { method: "gift_card", amountFils: gift.appliedFils, reference: gift.code },
                    ])
                  }
                >
                  Complete sale
                </Button>
              ) : (
                <>
                  <p className="text-sm">
                    <span className="numeric font-semibold">
                      {formatAED(total - gift.appliedFils)}
                    </span>{" "}
                    left to pay by:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {POS_METHODS.map((m) => (
                      <Button
                        key={m}
                        size="xl"
                        variant="outline"
                        disabled={busy || promo.pending}
                        onClick={() =>
                          complete([
                            {
                              method: "gift_card",
                              amountFils: gift.appliedFils,
                              reference: gift.code,
                            },
                            { method: m, amountFils: total - gift.appliedFils },
                          ])
                        }
                      >
                        {POS_METHOD_LABELS[m]}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              <Button variant="ghost" onClick={resetGift}>
                <X /> Remove gift card
              </Button>
            </div>
          ) : split ? (
            <div className="flex flex-col gap-2">
              {split.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <NativeSelect
                    aria-label={`Method ${i + 1}`}
                    value={row.method}
                    onChange={(e) =>
                      setSplit(
                        split.map((r, j) =>
                          j === i ? { ...r, method: e.target.value as PosMethod } : r,
                        ),
                      )
                    }
                    className="flex-1 [&_select]:h-12"
                  >
                    {POS_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {POS_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label={`Amount ${i + 1}`}
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) => {
                      const next = split.map((r, j) =>
                        j === i ? { ...r, amount: e.target.value } : r,
                      );
                      if (i < next.length - 1) {
                        const rest = balanceSplit(
                          total,
                          next.slice(0, -1).map((r) => Math.round(Number(r.amount || 0) * 100)),
                        );
                        if (rest !== null)
                          next[next.length - 1].amount = (rest / 100)
                            .toFixed(2)
                            .replace(/\.00$/, "");
                      }
                      setSplit(next);
                    }}
                    className="numeric h-12 w-32 text-lg"
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={() =>
                  setSplit([
                    ...split.slice(0, -1),
                    split[split.length - 1],
                    { method: "card_terminal", amount: "0" },
                  ])
                }
              >
                <Plus /> Add method
              </Button>
              <Button
                size="xl"
                disabled={!splitValid || busy || promo.pending}
                onClick={() =>
                  complete(
                    split.map((r) => ({
                      method: r.method,
                      amountFils: Math.round(Number(r.amount) * 100),
                    })),
                  )
                }
              >
                Complete sale
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {POS_METHODS.map((m) => (
                <Button
                  key={m}
                  size="xl"
                  variant={m === "cash" ? "default" : "outline"}
                  disabled={busy || Boolean(queuedTap)}
                  onClick={() => {
                    setPriceChanged(false);
                    if (promo.pending) setQueuedTap({ method: m, totalFils: total });
                    else void complete([{ method: m, amountFils: total }]);
                  }}
                >
                  {POS_METHOD_LABELS[m]}
                </Button>
              ))}
              {giftCards ? (
                <Button
                  size="xl"
                  variant="outline"
                  className="col-span-2"
                  disabled={busy || !online}
                  onClick={() => setGift("entering")}
                >
                  <Gift /> Gift card{online ? "" : " (needs a connection)"}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="col-span-2"
                onClick={() =>
                  setSplit([
                    { method: "cash", amount: "0" },
                    {
                      method: "card_terminal",
                      amount: (total / 100).toFixed(2).replace(/\.00$/, ""),
                    },
                  ])
                }
              >
                <Split /> Split payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {done ? (
        <div
          role="status"
          className="bg-burgundy text-cream fixed inset-x-0 top-20 z-50 mx-auto flex w-fit items-center gap-3 rounded-full px-5 py-3 shadow-lg"
        >
          {done.offline ? <CloudOff className="size-5" /> : <Check className="size-5" />}
          <span className="numeric font-medium">{done.label}</span>
        </div>
      ) : null}
    </div>
  );
}
