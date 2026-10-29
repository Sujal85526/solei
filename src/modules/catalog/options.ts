import { z } from "zod";
import { formatAED, type Fils } from "@/lib/money";

/**
 * Giveaways customiser: a product's option groups (single choice, multiple choice or a short text
 * such as the name on a tag) with per-option price changes. Pure — shared by the product page, the
 * cart and checkout. The database prices and checks every line again (`line_unit_price_fils`,
 * `line_options_check`); this mirrors it so the customer sees the same numbers.
 */

export type OptionGroupKind = "single" | "multi" | "text";

export type ProductOption = {
  id: string;
  label: string;
  priceDeltaFils: Fils;
  /** Photo of the choice (packaging, design), shown as a tile. */
  imageUrl?: string | null;
};

export type OptionGroup = {
  id: string;
  name: string;
  kind: OptionGroupKind;
  required: boolean;
  maxLength: number;
  options: ProductOption[];
};

/** What the customer chose, per group. */
export type LineOptions = { groupId: string; optionIds?: string[]; text?: string }[];

export const lineOptionsSchema = z
  .array(
    z.object({
      groupId: z.guid(),
      optionIds: z.array(z.guid()).max(20).optional(),
      text: z.string().max(200).optional(),
    }),
  )
  .max(10);

/** Stored on the order line: what was chosen, in words. */
export type OptionsSnapshot = {
  group: string;
  kind: OptionGroupKind;
  choices: { label: string; price_delta_fils: number }[];
  text: string | null;
}[];

const chosen = (groups: OptionGroup[], choices: LineOptions | undefined) =>
  groups.map((g) => {
    const c = choices?.find((x) => x.groupId === g.id);
    return {
      group: g,
      options: g.options.filter((o) => c?.optionIds?.includes(o.id)),
      text: c?.text?.trim() ?? "",
    };
  });

/** Variant price plus the chosen options' price changes. */
export function unitPriceWithOptions(
  baseFils: Fils,
  groups: OptionGroup[],
  choices: LineOptions | undefined,
): Fils {
  return chosen(groups, choices).reduce(
    (sum, c) => sum + c.options.reduce((s, o) => s + o.priceDeltaFils, 0),
    baseFils,
  );
}

/** First problem with the choices, in customer words, or null when they're complete. */
export function optionsProblem(
  groups: OptionGroup[],
  choices: LineOptions | undefined,
): string | null {
  for (const c of chosen(groups, choices)) {
    const g = c.group;
    if (g.kind === "text") {
      if (g.required && !c.text) return `Please fill in “${g.name}”.`;
      if (c.text.length > g.maxLength) return `“${g.name}” can be up to ${g.maxLength} characters.`;
    } else if (g.kind === "single") {
      if (c.options.length > 1) return `Choose one “${g.name}”.`;
      if (g.required && c.options.length === 0) return `Please choose “${g.name}”.`;
    } else if (g.required && c.options.length === 0) {
      return `Please choose “${g.name}”.`;
    }
  }
  return null;
}

/** Only what was actually chosen, in group order (what the cart stores). */
export function cleanChoices(groups: OptionGroup[], choices: LineOptions | undefined): LineOptions {
  return chosen(groups, choices).flatMap((c): LineOptions => {
    if (c.group.kind === "text") return c.text ? [{ groupId: c.group.id, text: c.text }] : [];
    return c.options.length
      ? [{ groupId: c.group.id, optionIds: c.options.map((o) => o.id).sort() }]
      : [];
  });
}

/**
 * Cart line identity: the variant alone, or the variant plus the chosen options (so two tags with
 * different names are two lines) and the giveaway it was bought through. Lines without options
 * keep the plain variant id.
 */
export function lineKey(variantId: string, options?: LineOptions, giveawayId?: string): string {
  const base = giveawayId ? `${variantId}@${giveawayId}` : variantId;
  if (!options?.length) return base;
  const parts = [...options]
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
    .map((o) => `${o.groupId}:${[...(o.optionIds ?? [])].sort().join(",")}:${o.text ?? ""}`);
  return `${base}|${parts.join(";")}`;
}

/** "Ribbon: Gold (+AED 5) · Name on the tag: Sara & Omar" */
export function describeChoices(
  groups: OptionGroup[],
  choices: LineOptions | undefined,
  { prices = false } = {},
): string {
  return chosen(groups, choices)
    .flatMap((c) => {
      if (c.group.kind === "text") return c.text ? [`${c.group.name}: ${c.text}`] : [];
      if (!c.options.length) return [];
      const labels = c.options.map((o) =>
        prices && o.priceDeltaFils ? `${o.label} (${deltaText(o.priceDeltaFils)})` : o.label,
      );
      return [`${c.group.name}: ${labels.join(", ")}`];
    })
    .join(" · ");
}

/** The same line from an order's snapshot. */
export function describeSnapshot(snapshot: OptionsSnapshot | null | undefined): string {
  if (!snapshot?.length) return "";
  return snapshot
    .map((s) =>
      s.kind === "text"
        ? `${s.group}: ${s.text}`
        : `${s.group}: ${s.choices.map((c) => c.label).join(", ")}`,
    )
    .join(" · ");
}

/** "+AED 5" / "−AED 2" */
export const deltaText = (fils: Fils) => `${fils < 0 ? "−" : "+"}${formatAED(Math.abs(fils))}`;

/** The database's shape for chosen options (`line_options_check` / `line_unit_price_fils`). */
export const toDbOptions = (options: LineOptions | undefined) =>
  options?.length
    ? options.map((o) => ({
        group_id: o.groupId,
        option_ids: o.optionIds ?? [],
        text: o.text ?? null,
      }))
    : undefined;

/** …and back (saved bags). */
export const fromDbOptions = (
  options: { group_id: string; option_ids?: string[]; text?: string | null }[] | null | undefined,
): LineOptions | undefined =>
  options?.length
    ? options.map((o) => ({
        groupId: o.group_id,
        ...(o.option_ids?.length ? { optionIds: o.option_ids } : {}),
        ...(o.text ? { text: o.text } : {}),
      }))
    : undefined;

/** Admin: one option group with its options (price change typed in AED, may be negative). */
export const optionGroupFormSchema = z
  .object({
    id: z.guid().optional(),
    productId: z.guid(),
    name: z.string().trim().min(1, "Name the choice, e.g. Ribbon").max(60),
    kind: z.enum(["single", "multi", "text"]),
    required: z.boolean(),
    maxLength: z.coerce.number().int().min(1).max(200).default(40),
    options: z
      .array(
        z.object({
          id: z.guid().optional(),
          label: z.string().trim().min(1, "Name every option").max(60),
          priceDelta: z
            .string()
            .trim()
            .transform((v, ctx) => {
              const n = Number(v.replace(/[,\s]/g, "") || "0");
              const fils = Math.round(n * 100);
              if (
                !Number.isFinite(n) ||
                Math.abs(n * 100 - fils) > 1e-6 ||
                Math.abs(fils) > 10_000_000
              ) {
                ctx.addIssue({ code: "custom", message: "An amount in AED, e.g. 5 or -2" });
                return z.NEVER;
              }
              return fils;
            }),
          active: z.boolean().default(true),
        }),
      )
      .max(30),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "text" && v.options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least one option" });
    }
  });
export type OptionGroupForm = z.input<typeof optionGroupFormSchema>;
