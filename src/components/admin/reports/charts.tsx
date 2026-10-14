"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { formatAED } from "@/lib/money";

/**
 * Single-series bar charts in brand burgundy (dataviz: one measure per chart, no dual axes,
 * recessive grid, thin bars with 4px rounded data ends, per-bar hover tooltip). Every chart
 * sits next to a table with the same numbers, so the chart is never the only way to read them.
 */

export type BarDatum = {
  label: string;
  /** fils for "aed", plain number otherwise */
  value: number;
  /** Secondary line in the tooltip, e.g. "38 units". */
  note?: string;
  /** De-emphasise (e.g. days other than the selected one). */
  muted?: boolean;
};

type Format = "aed" | "int" | "dec";

const INK = "var(--muted-foreground)";
const BAR = "var(--chart-1)";
const GRID = "color-mix(in oklab, var(--brand-burgundy) 10%, transparent)";

function fmt(value: number, format: Format): string {
  if (format === "aed") return formatAED(Math.round(value));
  if (format === "dec") return value.toLocaleString("en-AE", { maximumFractionDigits: 1 });
  return value.toLocaleString("en-AE");
}

/** SVG labels wrap on spaces; keep "AED 1,200" on one line. */
const nbsp = (s: string) => s.replace(/ /g, "\u00a0");

/** Compact axis ticks: "AED 12k". */
function tick(value: number, format: Format): string {
  if (format !== "aed") return value.toLocaleString("en-AE", { notation: "compact" });
  const aed = value / 100;
  return `AED ${aed.toLocaleString("en-AE", { notation: "compact", maximumFractionDigits: 1 })}`;
}

function TooltipBox({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  format: Format;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as BarDatum;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="numeric mt-0.5 text-sm font-semibold">{fmt(d.value, format)}</p>
      {d.note ? <p className="text-muted-foreground mt-0.5">{d.note}</p> : null}
    </div>
  );
}

/** Vertical columns — for a short ordered series such as revenue by event day. */
export function ColumnChart({
  data,
  format,
  label,
  height = 220,
}: {
  data: BarDatum[];
  format: Format;
  label: string;
  height?: number;
}) {
  return (
    <figure role="img" aria-label={label} className="m-0 w-full">
      <BarChart
        responsive
        data={data}
        style={{ width: "100%", height }}
        margin={{ top: 20, right: 4, bottom: 0, left: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: INK, fontSize: 11 }}
          interval={0}
        />
        <YAxis
          width={64}
          tickLine={false}
          axisLine={false}
          tick={{ fill: INK, fontSize: 11 }}
          tickFormatter={(v: number) => tick(v, format)}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklab, var(--brand-pink) 40%, transparent)" }}
          content={(p) => <TooltipBox {...p} format={format} />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={BAR} fillOpacity={d.muted ? 0.3 : 1} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            className="numeric"
            style={{ fill: "var(--foreground)", fontSize: 11 }}
            formatter={(v) => nbsp(tick(Number(v), format))}
          />
        </Bar>
      </BarChart>
    </figure>
  );
}

/** Horizontal bars — for named categories (destinations, methods, events). Sorted by caller. */
export function BarList({
  data,
  format,
  label,
  rowHeight = 34,
  labelWidth = 112,
}: {
  data: BarDatum[];
  format: Format;
  label: string;
  rowHeight?: number;
  labelWidth?: number;
}) {
  const height = Math.max(80, data.length * rowHeight + 16);
  return (
    <figure role="img" aria-label={label} className="m-0 w-full">
      <BarChart
        responsive
        layout="vertical"
        data={data}
        style={{ width: "100%", height }}
        margin={{ top: 0, right: format === "aed" ? 104 : 48, bottom: 0, left: 0 }}
        barCategoryGap="22%"
      >
        <XAxis
          type="number"
          hide
          domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={labelWidth}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklab, var(--brand-pink) 40%, transparent)" }}
          content={(p) => <TooltipBox {...p} format={format} />}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={BAR} fillOpacity={d.muted ? 0.3 : 1} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            className="numeric"
            style={{ fill: "var(--foreground)", fontSize: 11 }}
            formatter={(v) => nbsp(fmt(Number(v), format))}
          />
        </Bar>
      </BarChart>
    </figure>
  );
}
