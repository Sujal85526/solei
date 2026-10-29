import { describe, expect, it } from "vitest";
import { businessDay } from "@/lib/dates";
import {
  bookingRequestSchema,
  bookingSettingsSchema,
  configSchemas,
  emptyDraft,
  firstInvalidStep,
  sendQuoteSchema,
  statusChangeSchema,
  toSubmitPayload,
  validateStep,
  WIZARD_STEPS,
  type BookingDraft,
} from "./schema";
import { waLink, waTexts } from "./whatsapp";

const ID = "00000000-0000-4000-9000-000000000001";
const ID2 = "00000000-0000-4000-9000-000000000002";
const inDays = (n: number) => {
  const d = new Date(`${businessDay()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const step = (id: string) => WIZARD_STEPS.findIndex((s) => s.id === id);

const complete: BookingDraft = {
  ...emptyDraft,
  eventTypeId: ID,
  eventDate: inDays(30),
  startTime: "18:00",
  endTime: "01:00",
  location: "Emirates Palace",
  emirate: "abu_dhabi",
  guests: "150",
  serviceTypeIds: [ID, ID2],
  packageId: ID,
  boothDesignId: "",
  flowers: true,
  flowerOptionId: ID2,
  products: { perfume: "10", all_over_spray: "", dukhoon: "0" },
  name: "Mariam Al Test",
  phone: "050 111 2233",
  email: "Mariam@Example.com",
  specialRequests: "Pink and gold",
  consent: true,
};

describe("wizard steps", () => {
  it("has the owner's six steps ending with the summary", () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual([
      "type",
      "details",
      "package",
      "booth",
      "flowers",
      "summary",
    ]);
  });

  it("an empty draft fails on the first step", () => {
    expect(firstInvalidStep(emptyDraft)).toBe(0);
    expect(validateStep(0, emptyDraft)).toEqual({ eventTypeId: "Choose an option" });
  });

  it("a complete draft passes every step", () => {
    expect(firstInvalidStep(complete)).toBe(-1);
  });

  it("validates date, time and guests", () => {
    const errors = validateStep(step("details"), {
      ...complete,
      eventDate: inDays(-1),
      guests: "0",
      emirate: "",
    });
    expect(errors).toMatchObject({
      eventDate: "Choose a date from today",
      guests: "Enter the number of guests",
      emirate: "Choose the emirate",
    });
    expect(validateStep(step("details"), { ...complete, endTime: "18:00" })).toEqual({
      endTime: "The end time must differ from the start",
    });
    expect(validateStep(step("details"), { ...complete, eventDate: businessDay() })).toBeNull();
    expect(validateStep(step("details"), { ...complete, guests: "12.5" })).toEqual({
      guests: "Whole numbers only",
    });
  });

  it("services and products are no longer asked", () => {
    expect(firstInvalidStep({ ...complete, serviceTypeIds: [], products: { perfume: "-1" } })).toBe(
      -1,
    );
  });

  it("package and booth are optional", () => {
    expect(validateStep(step("package"), { ...complete, packageId: "" })).toBeNull();
    expect(validateStep(step("booth"), { ...complete, boothDesignId: "" })).toBeNull();
  });

  it("adding flowers needs a colour", () => {
    expect(validateStep(step("flowers"), { ...complete, flowerOptionId: "" })).toEqual({
      flowerOptionId: "Choose a flower colour",
    });
    expect(
      validateStep(step("flowers"), { ...complete, flowers: false, flowerOptionId: "" }),
    ).toBeNull();
  });

  it("event details include the contact: UAE phone, email and consent", () => {
    expect(
      validateStep(step("details"), { ...complete, phone: "12", email: "x", consent: false }),
    ).toMatchObject({
      phone: expect.any(String),
      email: "Enter a valid email",
      consent: "Please agree so we can contact you about your event",
    });
  });
});

describe("bookingRequestSchema", () => {
  it("normalises the request for the RPC", () => {
    const v = bookingRequestSchema.parse({
      ...complete,
      serviceTypeIds: [ID, ID, ID2],
      clientUuid: "11111111-1111-4111-8111-111111111111",
    });
    const p = toSubmitPayload(v);
    expect(p.contact).toEqual({
      name: "Mariam Al Test",
      phone: "+971501112233",
      email: "mariam@example.com",
    });
    expect(p.guests).toBe(150);
    // No longer asked: sent empty (the columns stay for staff).
    expect(p.products_interest).toEqual([]);
    expect(p.service_type_ids).toEqual([]);
    expect(p.booth_design_id).toBeNull();
    expect(p.flower_option_id).toBe(ID2);
    expect(p.end_time).toBe("01:00");
  });

  it("drops the flower colour when flowers are off", () => {
    const v = bookingRequestSchema.parse({
      ...complete,
      flowers: false,
      clientUuid: "11111111-1111-4111-8111-111111111111",
    });
    expect(v.flowerOptionId).toBeNull();
  });
});

describe("admin schemas", () => {
  it("quote: lines, deposit and validity", () => {
    const v = sendQuoteSchema.parse({
      bookingId: ID,
      lines: [{ label: "Booth", qty: "1", unitPriceFils: "650000" }],
      validUntil: inDays(14),
    });
    expect(v).toMatchObject({ discountFils: 0, depositFils: null, sendEmail: true });
    expect(
      sendQuoteSchema.safeParse({ bookingId: ID, lines: [], validUntil: inDays(1) }).success,
    ).toBe(false);
    expect(
      sendQuoteSchema.safeParse({
        bookingId: ID,
        lines: [{ label: "x", qty: 1, unitPriceFils: 1 }],
        validUntil: inDays(-1),
      }).success,
    ).toBe(false);
  });

  it("rejecting needs a reason", () => {
    expect(statusChangeSchema.safeParse({ bookingId: ID, status: "rejected" }).success).toBe(false);
    expect(
      statusChangeSchema.safeParse({ bookingId: ID, status: "rejected", reason: "Fully booked" })
        .success,
    ).toBe(true);
    expect(statusChangeSchema.safeParse({ bookingId: ID, status: "in_review" }).success).toBe(true);
  });

  it("config forms: AED to fils, lines to arrays, image URL rules", () => {
    const pkg = configSchemas.package.parse({
      name: "Signature",
      basePrice: "6,500.50",
      inclusions: "Booth\n\n Two hosts \n",
      images: "/images/events/booth-table.jpg\nhttps://cdn.example.com/a.jpg",
      active: "on",
    });
    expect(pkg).toMatchObject({
      basePrice: 650_050,
      inclusions: ["Booth", "Two hosts"],
      active: true,
      sort: 0,
    });
    expect(
      configSchemas.booth.safeParse({ name: "x", photos: "http://insecure.example.com/a.jpg" })
        .success,
    ).toBe(false);
    expect(configSchemas.flower.safeParse({ name: "Red", hex: "red", price: "0" }).success).toBe(
      false,
    );
  });

  it("booking settings: percent to basis points", () => {
    expect(
      bookingSettingsSchema.parse({ depositPercent: "50", flowerBase: "800", validityDays: "14" }),
    ).toEqual({ depositPercent: 5000, flowerBase: 80_000, validityDays: 14 });
    expect(
      bookingSettingsSchema.safeParse({ depositPercent: "120", flowerBase: "0", validityDays: "1" })
        .success,
    ).toBe(false);
  });
});

describe("WhatsApp links", () => {
  it("builds a wa.me link with encoded prefilled text", () => {
    const url = waLink("+971501112233", waTexts.greeting("Mariam Al Test", "BK-0001"));
    expect(url).toBe(
      "https://wa.me/971501112233?text=" +
        encodeURIComponent("Hello Mariam, this is Solei about your event request BK-0001. "),
    );
  });

  it("quote text includes the total and link", () => {
    expect(waTexts.quote("Mariam", "BK-0001", 600_000, "https://x/q")).toContain("AED 6,000");
  });
});
