import { describe, expect, it } from "vitest";
import { addLine, EMPTY_CART, keyOf, qtyOf, removeLine, setQty } from "@/modules/cart/logic";
import {
  cleanChoices,
  describeChoices,
  describeSnapshot,
  lineKey,
  optionGroupFormSchema,
  optionsProblem,
  unitPriceWithOptions,
  type OptionGroup,
} from "./options";

const g = (id: string, rest: Partial<OptionGroup>): OptionGroup => ({
  id,
  name: id,
  kind: "single",
  required: true,
  maxLength: 20,
  options: [],
  ...rest,
});
const groups: OptionGroup[] = [
  g("ribbon", {
    name: "Ribbon",
    options: [
      { id: "blush", label: "Blush", priceDeltaFils: 0 },
      { id: "gold", label: "Gold", priceDeltaFils: 500 },
    ],
  }),
  g("tag", { name: "Name on the tag", kind: "text" }),
  g("extras", {
    name: "Extras",
    kind: "multi",
    required: false,
    options: [{ id: "flower", label: "Dried flower", priceDeltaFils: 1000 }],
  }),
];

describe("options", () => {
  it("prices the chosen options on top of the variant", () => {
    expect(unitPriceWithOptions(2500, groups, [{ groupId: "ribbon", optionIds: ["gold"] }])).toBe(
      3000,
    );
    expect(
      unitPriceWithOptions(2500, groups, [
        { groupId: "ribbon", optionIds: ["gold"] },
        { groupId: "extras", optionIds: ["flower"] },
      ]),
    ).toBe(4000);
    // Unknown options are ignored (the database refuses them).
    expect(unitPriceWithOptions(2500, groups, [{ groupId: "ribbon", optionIds: ["nope"] }])).toBe(
      2500,
    );
  });

  it("says what's missing, in order", () => {
    expect(optionsProblem(groups, [])).toBe("Please choose “Ribbon”.");
    expect(optionsProblem(groups, [{ groupId: "ribbon", optionIds: ["gold"] }])).toBe(
      "Please fill in “Name on the tag”.",
    );
    expect(
      optionsProblem(groups, [
        { groupId: "ribbon", optionIds: ["gold"] },
        { groupId: "tag", text: "x".repeat(21) },
      ]),
    ).toMatch(/up to 20/);
    expect(
      optionsProblem(groups, [
        { groupId: "ribbon", optionIds: ["gold"] },
        { groupId: "tag", text: "Sara & Omar" },
      ]),
    ).toBeNull();
  });

  it("keeps only real choices and describes them", () => {
    const choices = cleanChoices(groups, [
      { groupId: "ribbon", optionIds: ["gold"] },
      { groupId: "tag", text: "  Sara  " },
      { groupId: "extras", optionIds: [] },
    ]);
    expect(choices).toEqual([
      { groupId: "ribbon", optionIds: ["gold"] },
      { groupId: "tag", text: "Sara" },
    ]);
    expect(describeChoices(groups, choices)).toBe("Ribbon: Gold · Name on the tag: Sara");
    expect(describeChoices(groups, choices, { prices: true })).toBe(
      "Ribbon: Gold (+AED 5) · Name on the tag: Sara",
    );
  });

  it("describes an order line's snapshot", () => {
    expect(
      describeSnapshot([
        {
          group: "Ribbon",
          kind: "single",
          choices: [{ label: "Gold", price_delta_fils: 500 }],
          text: null,
        },
        { group: "Name on the tag", kind: "text", choices: [], text: "Sara" },
      ]),
    ).toBe("Ribbon: Gold · Name on the tag: Sara");
    expect(describeSnapshot(null)).toBe("");
  });

  it("validates the admin form (negative price changes allowed)", () => {
    const r = optionGroupFormSchema.safeParse({
      productId: "6f1c2c1e-6a0e-4b6c-9d55-1b2b3c4d5e6f",
      name: "Box",
      kind: "single",
      required: true,
      options: [{ label: "Small", priceDelta: "-2" }],
    });
    expect(r.success && r.data.options[0].priceDelta).toBe(-200);
    expect(
      optionGroupFormSchema.safeParse({
        productId: "6f1c2c1e-6a0e-4b6c-9d55-1b2b3c4d5e6f",
        name: "Box",
        kind: "single",
        required: true,
        options: [],
      }).success,
    ).toBe(false);
  });
});

describe("cart lines with options", () => {
  const v = "6f1c2c1e-6a0e-4b6c-9d55-1b2b3c4d5e6f";
  const sara = [{ groupId: "tag", text: "Sara" }];
  const omar = [{ groupId: "tag", text: "Omar" }];

  it("ordinary lines keep the plain variant id as their key", () => {
    expect(lineKey(v)).toBe(v);
    expect(keyOf({ variantId: v })).toBe(v);
  });

  it("different choices are different lines; the same choices merge", () => {
    let s = addLine(EMPTY_CART, v, 20, sara);
    s = addLine(s, v, 20, omar);
    s = addLine(s, v, 5, sara);
    expect(s.lines.map((l) => l.qty)).toEqual([25, 20]);
    expect(qtyOf(s, v)).toBe(45);
    s = setQty(s, lineKey(v, omar), 30);
    expect(s.lines[1].qty).toBe(30);
    s = removeLine(s, lineKey(v, sara));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].options).toEqual(omar);
  });
});
