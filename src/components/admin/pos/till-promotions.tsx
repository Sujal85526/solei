"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAED } from "@/lib/money";
import { refusalMessage } from "@/modules/coupons/schema";
import type { LineOptions } from "@/modules/catalog/options";
import { posQuoteAction } from "@/modules/pos/promotions";
import { tillDue, tillTotal, type TillQuote } from "@/modules/pos/till";
import { appliedOffers, normaliseCodes } from "@/modules/promotions/quote";
import type { PointsReward } from "@/modules/promotions/schema";

export type TillLine = {
  variantId: string;
  qty: number;
  options?: LineOptions;
  giveawayId?: string;
  rewardId?: string;
};

const DEBOUNCE_MS = 300;

/**
 * Promotions for the sale in progress: sale prices and offers (automatic), codes, the customer's
 * points and points rewards — all priced by the database at this event. Offline the till sells at
 * catalogue prices (`priced` false), and codes, points and rewards wait for a connection.
 */
export function useTillPromotions({
  eventId,
  lines,
  online,
  phone,
  email,
  rewards,
}: {
  eventId: string;
  lines: TillLine[];
  online: boolean;
  phone: string;
  email: string;
  rewards: PointsReward[];
}) {
  const [codes, setCodes] = useState<string[]>([]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [rewardIds, setRewardIds] = useState<string[]>([]);
  const [usePoints, setUsePoints] = useState(false);
  const [result, setResult] = useState<{ key: string; quote: TillQuote } | null>(null);
  const request = useRef(0);

  const rewardLines = useMemo(
    () =>
      rewardIds.flatMap((id) => {
        const r = rewards.find((x) => x.id === id);
        return r ? [{ variantId: r.variantId, qty: 1, rewardId: r.id }] : [];
      }),
    [rewardIds, rewards],
  );
  const allLines = useMemo(() => [...lines, ...rewardLines], [lines, rewardLines]);
  const key = JSON.stringify([eventId, allLines, codes, phone.trim(), email.trim()]);

  useEffect(() => {
    if (!online || !lines.length) return;
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      const res = await posQuoteAction({
        eventId,
        lines: allLines,
        codes,
        customerPhone: phone.trim() || undefined,
        customerEmail: email.trim() || undefined,
      });
      if (id !== request.current || !res.ok) return;
      const refused = res.data.quote.codes.filter((c) => !c.ok);
      if (refused.length) {
        const last = refused[refused.length - 1];
        if (!last.ok) setCodeError(refusalMessage(last.reason, last.minOrderFils, last.minItems));
        setCodes((cs) => cs.filter((c) => !refused.some((r) => r.code === c)));
      }
      setResult({ key, quote: res.data });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online]);

  const fresh = online && lines.length > 0 && result?.key === key ? result.quote : null;
  const pointsOn = Boolean(fresh && usePoints && fresh.usablePoints > 0);
  const pointsFils = pointsOn && fresh ? fresh.usablePoints * fresh.pointValueFils : 0;

  return {
    /** Online and the price for the current cart hasn't come back yet. */
    pending: online && lines.length > 0 && !fresh,
    quote: fresh,
    codes,
    codeError,
    rewardIds,
    usePoints: pointsOn,
    /** Total of the sale, and what is left to pay after rewards and points (null = offline). */
    totalFils: fresh ? tillTotal(fresh.quote) : null,
    dueFils: fresh ? tillDue(fresh.quote, pointsFils) : null,
    pointsFils,
    addCode: (code: string) => {
      setCodeError(null);
      setCodes((cs) => normaliseCodes([...cs, code]));
    },
    removeCode: (code: string) => setCodes((cs) => cs.filter((c) => c !== code)),
    toggleReward: (id: string, on: boolean) =>
      setRewardIds((rs) =>
        on ? [...new Set([...rs, id])].slice(0, 3) : rs.filter((r) => r !== id),
      ),
    setUsePoints,
    /** What the sale sends with its lines. */
    saleExtras: () => ({
      rewardLines: fresh ? rewardLines : [],
      couponCodes: fresh ? codes : [],
      points: pointsOn && fresh ? fresh.usablePoints : 0,
      applyOffers: Boolean(fresh),
    }),
    reset: () => {
      setCodes([]);
      setCodeError(null);
      setRewardIds([]);
      setUsePoints(false);
      setResult(null);
    },
  };
}

export type TillPromotions = ReturnType<typeof useTillPromotions>;

/** The promotions part of the payment dialog. */
export function TillPromotionsPanel({
  promo,
  rewards,
  online,
}: {
  promo: TillPromotions;
  rewards: PointsReward[];
  online: boolean;
}) {
  const [value, setValue] = useState("");
  if (!online) {
    return (
      <p className="text-muted-foreground rounded-lg border p-3 text-xs">
        Offline: catalogue prices. Codes, offers and points need a connection.
      </p>
    );
  }
  const q = promo.quote?.quote;
  const offers = q ? appliedOffers(q) : [];
  const codeFils = q?.codeDiscountFils ?? 0;
  const balance = promo.quote?.pointsBalance ?? null;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Offers, codes and points</legend>
      {q && (q.saleFils || offers.length || codeFils) ? (
        <dl className="numeric flex flex-col gap-1 text-sm">
          {q.saleFils ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sale prices</dt>
              <dd>−{formatAED(q.saleFils)}</dd>
            </div>
          ) : null}
          {offers.map((o) => (
            <div key={o.offerId} className="flex justify-between">
              <dt className="text-muted-foreground">{o.name}</dt>
              <dd>−{formatAED(o.discountFils)}</dd>
            </div>
          ))}
          {codeFils ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Codes</dt>
              <dd>−{formatAED(codeFils)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {promo.codes.map((c) => (
        <div
          key={c}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2 font-mono">
            <Tag className="text-primary size-4" /> {c}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${c}`}
            onClick={() => promo.removeCode(c)}
          >
            <X />
          </Button>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) promo.addCode(value);
          setValue("");
        }}
      >
        <Input
          aria-label="Discount code"
          autoCapitalize="characters"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Discount code"
          className="h-12 flex-1 font-mono text-base uppercase"
        />
        <Button type="submit" size="xl" variant="outline" disabled={!value.trim()}>
          Apply
        </Button>
      </form>
      {promo.codeError ? (
        <p role="alert" className="text-destructive text-sm">
          {promo.codeError}
        </p>
      ) : null}
      {balance === null ? (
        <p className="text-muted-foreground text-xs">
          Add the customer&apos;s mobile or email above to use their points or a VIP code.
        </p>
      ) : (
        <>
          <p className="text-sm">
            <Award className="text-primary me-1 inline size-4" />
            {balance.toLocaleString("en-GB")} points
          </p>
          {promo.quote && promo.quote.usablePoints > 0 ? (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={promo.usePoints}
                onChange={(e) => promo.setUsePoints(e.target.checked)}
                className="accent-primary size-5"
              />
              Use {promo.quote.usablePoints.toLocaleString("en-GB")} points (
              {formatAED(promo.quote.usablePoints * promo.quote.pointValueFils)} off)
            </label>
          ) : null}
          {rewards.map((r) => {
            const chosen = promo.rewardIds.includes(r.id);
            return (
              <label key={r.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={chosen}
                  disabled={!chosen && r.points > balance}
                  onChange={(e) => promo.toggleReward(r.id, e.target.checked)}
                  className="accent-primary size-5"
                />
                <span className="flex-1">
                  Reward: {r.name}
                  <span className="text-muted-foreground block text-xs">
                    {r.points.toLocaleString("en-GB")} points · {formatAED(r.priceFils)}
                  </span>
                </span>
              </label>
            );
          })}
        </>
      )}
    </fieldset>
  );
}
