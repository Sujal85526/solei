"use client";

import { useState } from "react";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { accountCopy as c } from "@/content/account";
import { formatAED } from "@/lib/money";
import { setMyBirthdayAction } from "@/modules/points/actions";
import { MONTHS, type PointsSummary } from "@/modules/points/schema";

/** Account → Rewards: tier, points and their value, the next tier, and the birthday for the bonus. */
export function RewardsPanel({
  summary,
  birthday,
  birthdayPoints,
}: {
  summary: PointsSummary;
  birthday: { month: number; day: number } | null;
  birthdayPoints: number | null;
}) {
  const next = summary.nextTier;
  const progress = next ? Math.min(1, summary.spend12mFils / Math.max(1, next.minSpendFils)) : 1;
  return (
    <div className="border-border border-b py-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-muted-foreground font-sans text-[0.6rem] tracking-[0.25em] uppercase">
          {c.page.rewards}
        </h2>
        {summary.tier ? (
          <span className="text-primary text-[0.65rem] tracking-[0.2em] uppercase">
            {summary.tier.name}
          </span>
        ) : null}
      </div>
      <p className="font-display mt-3 text-3xl">
        {summary.balance.toLocaleString("en-GB")}{" "}
        <span className="font-sans text-sm">{c.page.points}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        {c.page.pointsWorth(formatAED(summary.balanceValueFils))}
      </p>
      {summary.tier?.perks ? <p className="mt-2 text-sm">{summary.tier.perks}</p> : null}
      {next ? (
        <div className="mt-4">
          <div className="bg-primary/15 h-1 w-full overflow-hidden rounded-full">
            <div className="bg-primary h-full" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {c.page.toNextTier(formatAED(next.toGoFils), next.name)}
          </p>
        </div>
      ) : null}
      {birthdayPoints ? <BirthdayForm birthday={birthday} points={birthdayPoints} /> : null}
    </div>
  );
}

function BirthdayForm({
  birthday,
  points,
}: {
  birthday: { month: number; day: number } | null;
  points: number;
}) {
  const [state, action, pending] = useFormAction(setMyBirthdayAction, null);
  const e = useActionToast(state);
  const [month, setMonth] = useState(birthday?.month ?? 0);
  const select =
    "border-input focus:border-primary h-10 rounded-sm border bg-white px-2 text-sm outline-none";
  return (
    <form {...action} className="mt-5 flex flex-col gap-2">
      <p className="text-sm">
        {c.page.birthday}{" "}
        <span className="text-muted-foreground text-xs">{c.page.birthdayHint(points)}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="day"
          aria-label={c.page.birthdayDay}
          defaultValue={birthday?.day ?? 0}
          className={select}
        >
          <option value={0}>{c.page.birthdayDay}</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          name="month"
          aria-label={c.page.birthdayMonth}
          value={month}
          onChange={(ev) => setMonth(Number(ev.target.value))}
          className={select}
        >
          <option value={0}>{c.page.birthdayMonth}</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="text-primary text-xs underline underline-offset-4"
        >
          {pending ? "…" : c.page.save}
        </button>
      </div>
      {e.day ? <p className="text-destructive text-xs">{e.day}</p> : null}
    </form>
  );
}
