"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Gift, Lock, Tag } from "lucide-react";
import { AccountGate } from "@/components/store/account/account-gate";
import type { ZoneOption } from "@/components/store/account/emirate-select";
import { AddressFields } from "@/components/store/account/profile-forms";
import { PhoneField } from "@/components/store/account/phone-field";
import { refreshAccount } from "@/components/store/account/use-account";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/modules/account/actions";
import type { SavedAddress } from "@/modules/account/schema";
import { getCartDetails } from "@/modules/cart/actions";
import type { CartDetails } from "@/modules/cart/details";
import type { Emirate } from "@/modules/cart/schema";
import type { CartState } from "@/modules/cart/logic";
import { cartDrawer } from "@/modules/cart/drawer";
import { cart, useCart } from "@/modules/cart/store";
import { placeOrderAction } from "@/modules/checkout/actions";
import { maskGiftCode } from "@/modules/gift-cards/schema";

const c = t.checkout;

export type CheckoutAccount = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: SavedAddress | null;
};

/**
 * Checkout: Account → Delivery → Payment (hosted). Signed-out visitors sign in or create an
 * account first; signed-in customers get their details and saved address prefilled.
 * Light, two columns on wide screens (form · order summary); the summary folds away on phones.
 */
export function CheckoutFlow({
  zones,
  account,
}: {
  zones: ZoneOption[];
  account: CheckoutAccount | null;
}) {
  const state = useCart();
  const [details, setDetails] = useState<CartDetails | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [, startLoad] = useTransition();
  const req = useRef(0);
  // Discount codes being applied (several when they combine); a refused one is dropped again.
  const [coupons, setCoupons] = useState<string[]>([]);
  // Points rewards chosen in the summary.
  const [rewards, setRewards] = useState<string[]>([]);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, startApply] = useTransition();
  // Gift card being applied (signed-in customers); dropped again if the server refuses it.
  const [giftCard, setGiftCard] = useState<string | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  // Spend points (signed-in, programme on).
  const [usePoints, setUsePoints] = useState(false);
  const key = state
    ? JSON.stringify([state.lines, state.emirate, coupons, giftCard, usePoints, rewards])
    : null;

  // A saved address picks the emirate (and so the delivery fee) when none is chosen yet.
  useEffect(() => {
    if (state && !state.emirate && account?.address?.emirate)
      cart.setEmirate(account.address.emirate);
  }, [state, account]);

  useEffect(() => {
    if (!state || !state.lines.length) return;
    const id = ++req.current;
    const load = coupons.length || giftCard ? startApply : startLoad;
    load(async () => {
      const res = await getCartDetails({
        lines: state.lines,
        emirate: state.emirate,
        coupons,
        giftCard,
        usePoints,
        rewards,
      });
      if (id !== req.current) return;
      setDetails(res);
      const refused = (res.coupons ?? []).filter((r) => "error" in r);
      if (refused.length) {
        const last = refused[refused.length - 1];
        setCouponError("error" in last ? last.error : null);
        setCoupons((cs) => cs.filter((code) => !refused.some((r) => r.code === code)));
      }
      const kept = res.lines.filter((l) => l.rewardId && l.qty > 0).map((l) => l.rewardId!);
      if (kept.length !== rewards.length) setRewards(kept);
      if (res.giftCard && "error" in res.giftCard) {
        setGiftError(res.giftCard.error);
        setGiftCard(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const applied = (details?.coupons ?? []).flatMap((r) => ("discountFils" in r ? [r] : []));
  const couponProps: CouponProps = {
    applied,
    error: couponError,
    applying,
    onApply: (code: string) => {
      setCouponError(null);
      setCoupons((cs) => [...new Set([...cs, code.trim().toUpperCase()])].slice(0, 5));
    },
    onRemove: (code: string) => {
      setCouponError(null);
      setCoupons((cs) => cs.filter((c) => c !== code));
    },
  };
  const rewardProps: RewardProps = {
    chosen: rewards,
    onToggle: (id: string, on: boolean) =>
      setRewards((rs) => (on ? [...new Set([...rs, id])].slice(0, 3) : rs.filter((r) => r !== id))),
  };

  const appliedGift =
    details?.giftCard && "appliedFils" in details.giftCard ? details.giftCard : null;
  const giftProps: GiftCardProps | null = account
    ? {
        applied: appliedGift,
        error: giftError,
        applying,
        onApply: (code: string) => {
          setGiftError(null);
          setGiftCard(code);
        },
        onRemove: () => {
          setGiftError(null);
          setGiftCard(null);
        },
      }
    : null;

  if (!state) return <div className="flex-1" />;
  if (!state.lines.length && !redirecting) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start gap-5 px-5 py-20 sm:px-10">
        <h1 className="text-4xl">{c.empty}</h1>
        <Link
          href="/shop"
          className="text-primary text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
        >
          {c.shop}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Order summary: folds on phones (top), fixed column on wide screens (end). */}
      <aside className="bg-muted border-border border-b lg:order-2 lg:w-[44%] lg:border-s lg:border-b-0">
        <details className="group lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-10 [&::-webkit-details-marker]:hidden">
            <span className="text-primary flex items-center gap-2 text-sm">
              <span className="group-open:hidden">{c.showSummary}</span>
              <span className="hidden group-open:inline">{c.hideSummary}</span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </span>
            <span className="numeric font-display text-xl">
              {details ? formatAED(details.pricing.totalFils) : "—"}
            </span>
          </summary>
          <div className="px-5 pb-8 sm:px-10">
            <Summary
              details={details}
              coupon={couponProps}
              giftCard={giftProps}
              usePoints={usePoints}
              onUsePoints={setUsePoints}
              rewards={rewardProps}
            />
          </div>
        </details>
        <div className="sticky top-0 hidden max-w-md px-12 py-14 lg:block">
          <Summary
            details={details}
            coupon={couponProps}
            giftCard={giftProps}
            usePoints={usePoints}
            onUsePoints={setUsePoints}
            rewards={rewardProps}
          />
        </div>
      </aside>

      <div className="flex-1 lg:order-1">
        <div className="mx-auto w-full max-w-xl px-5 py-10 sm:px-10 lg:me-0 lg:py-14 lg:ps-10 lg:pe-14">
          {account ? (
            <DeliveryForm
              account={account}
              zones={zones}
              state={state}
              details={details}
              couponCodes={applied.map((a) => a.code)}
              rewardIds={rewards}
              giftCardCode={appliedGift?.code ?? null}
              usePoints={Boolean(details?.points?.usable && details.points.applied)}
              onDetails={setDetails}
              redirecting={redirecting}
              onRedirect={() => setRedirecting(true)}
            />
          ) : (
            <div className="mt-8 max-w-sm">
              <AccountGate initialMode="signUp" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryForm({
  account,
  zones,
  state,
  details,
  couponCodes,
  rewardIds,
  giftCardCode,
  usePoints,
  onDetails,
  redirecting,
  onRedirect,
}: {
  account: CheckoutAccount;
  zones: ZoneOption[];
  state: CartState;
  details: CartDetails | null;
  couponCodes: string[];
  rewardIds: string[];
  giftCardCode: string | null;
  usePoints: boolean;
  onDetails: (d: CartDetails) => void;
  redirecting: boolean;
  onRedirect: () => void;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  // Idempotency key for this checkout, created on first submit (re-submits reuse it).
  const clientUuid = useRef<string | null>(null);
  const pricing = details?.pricing;
  // After points / a gift card (null when neither is applied).
  const due = details ? amountDue(details) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreed) return setFormError(c.policy.mustAgree);
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    setErrors({});
    setFormError(null);
    startSubmit(async () => {
      clientUuid.current ??= crypto.randomUUID();
      const res = await placeOrderAction({
        ...fd,
        clientUuid: clientUuid.current,
        lines: state.lines,
        coupons: couponCodes,
        rewards: rewardIds,
        giftCard: giftCardCode ?? "",
        usePoints,
      });
      if (res.ok) {
        onRedirect();
        window.location.assign(res.data.redirectUrl);
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
      // Stock, prices or the discount may have changed — refresh the summary.
      const fresh = await getCartDetails({
        lines: state.lines,
        emirate: state.emirate,
        coupons: couponCodes,
        rewards: rewardIds,
        giftCard: giftCardCode,
        usePoints,
      });
      onDetails(fresh);
      const allowed = new Map(
        fresh.lines.filter((l) => l.status !== "ok").map((l) => [l.key, l.qty]),
      );
      if (allowed.size) cart.reconcile(allowed);
    });
  }

  const label = "text-[0.65rem] tracking-[0.25em] uppercase";

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-8">
      <section aria-labelledby="contact-title" className="flex flex-col gap-3">
        <h2 id="contact-title" className={cn(label, "text-muted-foreground font-sans")}>
          {c.contact}
        </h2>
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-y py-4">
          <p className="text-sm">
            <span className="text-muted-foreground">{c.signedInAs} </span>
            {account.email}
          </p>
          <button
            type="button"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                await signOutAction();
                await refreshAccount();
                router.refresh();
              })
            }
            className="text-muted-foreground hover:text-primary -my-2.5 py-2.5 text-xs underline underline-offset-4"
          >
            {c.notYou}
          </button>
        </div>
      </section>

      <section
        aria-labelledby="delivery-title"
        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-4"
      >
        <h2
          id="delivery-title"
          className={cn(label, "text-muted-foreground col-span-2 -mb-1 font-sans")}
        >
          {c.delivery}
        </h2>
        <AddressFields
          initial={account.address}
          zones={zones}
          errors={errors}
          emirate={state.emirate ?? ""}
          onEmirateChange={(v) => cart.setEmirate((v || null) as Emirate | null)}
        />
        <PhoneField
          label={c.phone}
          defaultValue={account.phone}
          hint={c.phoneHint}
          error={errors.phone}
          className="col-span-2"
        />
        <div className="col-span-2 flex flex-col gap-3 pt-1">
          <Check name="saveAddress" defaultChecked>
            {c.saveAddress}
          </Check>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {/* On phones the order summary is folded away at the top — show the sums by the button. */}
        <dl className="numeric border-border flex flex-col gap-2 border-t pt-5 text-sm lg:hidden">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{c.subtotal}</dt>
            <dd>{pricing ? formatAED(pricing.subtotalFils) : "—"}</dd>
          </div>
          {pricing?.discountFils ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{c.discount}</dt>
              <dd className="text-primary">−{formatAED(pricing.discountFils)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{c.shipping}</dt>
            <dd>
              {pricing?.deliveryFeeFils == null
                ? c.chooseEmirate
                : pricing.deliveryFeeFils === 0
                  ? c.free
                  : formatAED(pricing.deliveryFeeFils)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-display text-lg">{c.total}</dt>
            <dd className="font-display text-primary text-xl">
              {pricing ? formatAED(pricing.totalFils) : "—"}
            </dd>
          </div>
          {due !== null ? (
            <div className="flex justify-between font-medium">
              <dt>{c.toPay}</dt>
              <dd>{formatAED(due)}</dd>
            </div>
          ) : null}
        </dl>
        {/* Purchase terms by the total, where the customer commits (card-acquirer requirement):
            a tick to agree, linking out to the Terms and Returns policy. */}
        <div className="border-border flex flex-col gap-2 border-t pt-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setFormError(null);
              }}
              className="accent-primary mt-0.5 size-4 shrink-0"
            />
            <span className="text-foreground/85">
              {c.policy.agree}{" "}
              <Link
                href="/help?tab=terms"
                target="_blank"
                className="hover:text-primary underline underline-offset-4"
              >
                {c.policy.terms}
              </Link>{" "}
              {c.policy.and}{" "}
              <Link
                href="/help?tab=returns"
                target="_blank"
                className="hover:text-primary underline underline-offset-4"
              >
                {c.policy.returnsLink}
              </Link>
            </span>
          </label>
        </div>
        {formError ? (
          <p role="alert" className="bg-destructive/8 text-destructive px-4 py-3 text-sm">
            {formError}
          </p>
        ) : null}
        <Button
          type="submit"
          size="cta"
          disabled={submitting || redirecting || !pricing}
          className="h-12 w-full"
        >
          <Lock className="size-3.5" />
          {submitting || redirecting
            ? c.paying
            : due === 0
              ? c.placeOrder
              : pricing
                ? `${c.pay} · ${formatAED(due ?? pricing.totalFils)}`
                : c.pay}
        </Button>
        <button
          type="button"
          onClick={cartDrawer.open}
          className="text-muted-foreground hover:text-primary self-start text-xs underline-offset-4 hover:underline"
        >
          ← {c.backToBag}
        </button>
      </div>
    </form>
  );
}

function Check({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary mt-0.5 size-4 shrink-0"
      />
      <span className="text-foreground/85">{children}</span>
    </label>
  );
}

type GiftCardProps = {
  applied: { code: string; appliedFils: number; dueFils: number } | null;
  error: string | null;
  applying: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
};

type CouponProps = {
  applied: { code: string; discountFils: number; freeDelivery: boolean }[];
  error: string | null;
  applying: boolean;
  onApply: (code: string) => void;
  onRemove: (code: string) => void;
};

type RewardProps = { chosen: string[]; onToggle: (id: string, on: boolean) => void };

/** Paid by points: the chosen rewards. */
const rewardValue = (details: CartDetails) =>
  details.lines.reduce((s, l) => s + (l.rewardId && l.qty > 0 ? l.lineTotalFils : 0), 0);

/**
 * Left to pay on the card page after rewards, points and a gift card (null when nothing is
 * applied).
 */
function amountDue(details: CartDetails): number | null {
  const pts = details.points?.usable && details.points.applied ? details.points.valueFils : 0;
  const gift = details.giftCard && "dueFils" in details.giftCard ? details.giftCard : null;
  if (gift) return gift.dueFils;
  const paid = pts + rewardValue(details);
  return paid ? details.pricing.totalFils - paid : null;
}

function Summary({
  details,
  coupon,
  giftCard,
  usePoints,
  onUsePoints,
  rewards,
}: {
  details: CartDetails | null;
  coupon: CouponProps;
  giftCard: GiftCardProps | null;
  usePoints: boolean;
  onUsePoints: (on: boolean) => void;
  rewards: RewardProps;
}) {
  const points = details?.points;
  const due = details ? amountDue(details) : null;
  const pricing = details?.pricing;
  const lines = (details?.lines ?? []).filter((l) => l.qty > 0);
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-muted-foreground hidden font-sans text-[0.65rem] tracking-[0.25em] uppercase lg:block">
        {c.summary}
      </h2>
      <ul className="flex flex-col gap-4">
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-4">
            <div className="border-border relative size-16 shrink-0 rounded-sm border bg-white">
              {l.product?.image ? (
                <Image
                  src={l.product.image.url}
                  alt={l.product.image.alt ?? ""}
                  fill
                  sizes="64px"
                  className="rounded-sm object-cover"
                />
              ) : null}
              <span className="bg-primary text-primary-foreground numeric absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full text-[0.65rem]">
                {l.qty}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-lg leading-tight">{l.product?.name}</p>
              {l.hasVariants ? (
                <p className="text-muted-foreground text-xs">{l.variantLabel}</p>
              ) : null}
              {l.optionsText ? (
                <p className="text-muted-foreground text-xs">{l.optionsText}</p>
              ) : null}
              {l.rewardId ? (
                <p className="text-primary text-xs">
                  {c.rewardLine} · {c.rewardPoints((l.rewardPoints ?? 0).toLocaleString("en-GB"))}
                </p>
              ) : l.saleName ? (
                <p className="text-primary text-xs">{l.saleName}</p>
              ) : null}
            </div>
            <p className="numeric text-end text-sm">
              {l.listUnitFils && l.listUnitFils > l.unitPriceFils ? (
                <s className="text-muted-foreground block text-xs">
                  {formatAED(l.listUnitFils * l.qty)}
                </s>
              ) : null}
              {formatAED(l.lineTotalFils)}
            </p>
          </li>
        ))}
      </ul>
      {coupon.applied.map((a) => (
        <AppliedCode key={a.code} code={a.code} onRemove={() => coupon.onRemove(a.code)} />
      ))}
      <CouponBox
        // A fresh, empty box once a code is applied (or removed), ready for the next one.
        key={coupon.applied.map((a) => a.code).join()}
        {...coupon}
        applied={null}
        onRemove={() => {}}
        label={coupon.applied.length ? c.anotherCode : c.discountCode}
      />
      {details?.rewardOptions?.length ? (
        <fieldset className="border-border flex flex-col gap-2 border-t pt-5 text-sm">
          <legend className="text-muted-foreground mb-2 text-xs">{c.rewards}</legend>
          {details.rewardOptions.map((r) => (
            <label
              key={r.id}
              className={cn("flex items-start gap-3", !r.affordable && "opacity-50")}
            >
              <input
                type="checkbox"
                disabled={!r.affordable}
                checked={rewards.chosen.includes(r.id)}
                onChange={(e) => rewards.onToggle(r.id, e.target.checked)}
                className="accent-primary mt-0.5 size-4"
              />
              <span>
                {r.name}
                <span className="text-muted-foreground block text-xs">
                  {c.rewardPoints(r.points.toLocaleString("en-GB"))} · {formatAED(r.priceFils)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {giftCard ? (
        <CouponBox
          {...giftCard}
          label={c.giftCard}
          icon={Gift}
          display={maskGiftCode}
          className="border-t-0 pt-0"
        />
      ) : null}
      {points ? (
        points.usable ? (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => onUsePoints(e.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              {c.usePoints(points.points.toLocaleString("en-GB"), formatAED(points.valueFils))}
              <span className="text-muted-foreground block text-xs">
                {c.pointsBalance(points.balance.toLocaleString("en-GB"))}
              </span>
            </span>
          </label>
        ) : (
          <p className="text-muted-foreground text-xs">
            {c.pointsBalance(points.balance.toLocaleString("en-GB"))} {points.reason}
          </p>
        )
      ) : null}
      <dl className="numeric border-border flex flex-col gap-2.5 border-t pt-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{c.subtotal}</dt>
          <dd>{pricing ? formatAED(pricing.subtotalFils) : "—"}</dd>
        </div>
        {details?.offers?.map((o) => (
          <div key={o.offerId} className="flex justify-between">
            <dt className="text-muted-foreground">{o.name}</dt>
            <dd className="text-primary">−{formatAED(o.discountFils)}</dd>
          </div>
        ))}
        {coupon.applied.length && pricing?.discountFils ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {c.discount} ({coupon.applied.map((a) => a.code).join(", ")})
            </dt>
            <dd className="text-primary">
              −
              {formatAED(
                pricing.discountFils -
                  (details?.offers ?? []).reduce((s, o) => s + o.discountFils, 0),
              )}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            {c.shipping}
            {coupon.applied.find((a) => a.freeDelivery) && pricing?.deliveryDiscountFils
              ? ` (${coupon.applied.find((a) => a.freeDelivery)!.code})`
              : ""}
          </dt>
          <dd>
            {pricing?.deliveryDiscountFils ? (
              <s className="text-muted-foreground me-2">
                {formatAED(pricing.deliveryDiscountFils)}
              </s>
            ) : null}
            {pricing?.deliveryFeeFils == null
              ? c.chooseEmirate
              : pricing.deliveryFeeFils === 0
                ? c.free
                : formatAED(pricing.deliveryFeeFils)}
          </dd>
        </div>
        <div className="border-border mt-2 flex items-baseline justify-between border-t pt-5">
          <dt className="font-display text-xl">{c.total}</dt>
          <dd className="font-display text-primary text-3xl">
            <span className="text-muted-foreground me-2 font-sans text-[0.65rem] tracking-[0.2em]">
              AED
            </span>
            {pricing ? formatAED(pricing.totalFils).replace(/^AED\s*/, "") : "—"}
          </dd>
        </div>
        {details && rewardValue(details) ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{c.rewards}</dt>
            <dd className="text-primary">−{formatAED(rewardValue(details))}</dd>
          </div>
        ) : null}
        {points?.usable && points.applied ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{c.points}</dt>
            <dd className="text-primary">−{formatAED(points.valueFils)}</dd>
          </div>
        ) : null}
        {giftCard?.applied ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {c.giftCard} {maskGiftCode(giftCard.applied.code)}
            </dt>
            <dd className="text-primary">−{formatAED(giftCard.applied.appliedFils)}</dd>
          </div>
        ) : null}
        {due !== null ? (
          <div className="flex justify-between font-medium">
            <dt>{c.toPay}</dt>
            <dd>{formatAED(due)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** An applied discount code, with a way to remove it. */
function AppliedCode({ code, onRemove }: { code: string; onRemove: () => void }) {
  return (
    <div className="border-border flex items-center justify-between gap-3 border-t pt-5 text-sm">
      <span className="flex items-center gap-2">
        <Tag className="text-primary size-3.5" />
        <span className="font-medium tracking-wide">{code}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-primary -my-2.5 py-2.5 text-xs underline underline-offset-4"
      >
        {c.removeCode}
      </button>
    </div>
  );
}

/**
 * Code box in the order summary (discount code, gift card): type a code and apply, or remove the
 * applied one.
 */
function CouponBox({
  applied,
  error,
  applying,
  onApply,
  onRemove,
  label,
  icon: Icon = Tag,
  display = (code) => code,
  className,
}: Omit<CouponProps, "applied"> & {
  applied: { code: string } | null;
  label: string;
  icon?: typeof Tag;
  display?: (code: string) => string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  if (applied) {
    return (
      <div
        className={cn(
          "border-border flex items-center justify-between gap-3 border-t pt-5 text-sm",
          className,
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className="text-primary size-3.5" />
          <span className="font-medium tracking-wide">{display(applied.code)}</span>
        </span>
        <button
          type="button"
          onClick={() => onRemove(applied.code)}
          className="text-muted-foreground hover:text-primary -my-2.5 py-2.5 text-xs underline underline-offset-4"
        >
          {c.removeCode}
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onApply(value.trim());
      }}
      className={cn("border-border flex flex-col gap-2 border-t pt-5", className)}
    >
      <div className="flex gap-2">
        <input
          aria-label={label}
          placeholder={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className="border-border focus-visible:border-primary h-11 min-w-0 flex-1 border bg-white px-3 text-sm uppercase outline-none placeholder:normal-case"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={applying || !value.trim()}
          className="h-11 px-5"
        >
          {applying ? "…" : c.applyCode}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}
