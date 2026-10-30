import { describe, expect, it } from "vitest";
import {
  averageOrderFils,
  consentChannels,
  consentState,
  createCustomerSchema,
  filtersToQuery,
  parseCustomerFilters,
  recordConsentSchema,
  updateContactSchema,
  updateNotesSchema,
} from "./schema";

const ID = "8b0f1f0e-6a43-4e57-9d43-2b8f7f0c1a11";

describe("createCustomerSchema", () => {
  it("normalises phone and email and defaults the source", () => {
    const v = createCustomerSchema.parse({
      name: " Layla ",
      phone: "050 123 4567",
      email: " Layla@Example.COM ",
      emirate: "abu_dhabi",
      marketingConsent: "on",
    });
    expect(v).toEqual({
      name: "Layla",
      phone: "+971501234567",
      email: "layla@example.com",
      emirate: "abu_dhabi",
      marketingConsent: true,
      source: "manual",
      pastStamps: 0,
      sendWelcome: false,
    });
  });

  it("takes earlier-order stickers and the welcome tick-box", () => {
    const v = createCustomerSchema.parse({
      name: "Noor",
      email: "noor@example.com",
      pastStamps: "4",
      sendWelcome: "on",
    });
    expect(v).toMatchObject({ pastStamps: 4, sendWelcome: true });
    expect(
      createCustomerSchema.parse({ name: "Noor", email: "noor@example.com", pastStamps: "" })
        .pastStamps,
    ).toBe(0);
    for (const bad of ["-1", "101", "2.5", "abc"]) {
      expect(
        createCustomerSchema.safeParse({ name: "Noor", email: "noor@example.com", pastStamps: bad })
          .success,
      ).toBe(false);
    }
  });

  it("treats a blank phone, emirate and source as null / defaults", () => {
    const v = createCustomerSchema.parse({
      name: "Omar",
      phone: "",
      email: "omar@example.com",
      emirate: "",
      source: "pos",
    });
    expect(v).toMatchObject({
      phone: null,
      email: "omar@example.com",
      emirate: null,
      marketingConsent: false,
      source: "pos",
    });
  });

  it("needs a name and a phone or an email — either one is enough", () => {
    const none = createCustomerSchema.safeParse({ name: "Amal", phone: "", email: "" });
    expect(none.success).toBe(false);
    expect(none.error!.issues[0]).toMatchObject({ path: ["phone"] });
    expect(none.error!.issues[0].message).toMatch(/phone number or an email/);

    const noName = createCustomerSchema.safeParse({ name: "A", phone: "0501234567" });
    expect(noName.success).toBe(false);
    expect(noName.error!.issues.map((i) => i.path[0])).toContain("name");

    const phoneOnly = createCustomerSchema.parse({
      name: "Amal",
      phone: "050 123 4567",
      email: "",
    });
    expect(phoneOnly).toMatchObject({ phone: "+971501234567", email: null });

    const emailOnly = createCustomerSchema.parse({ name: "Amal", email: "amal@example.com" });
    expect(emailOnly).toMatchObject({ phone: null, email: "amal@example.com" });
  });

  it("rejects invalid phones and emails with friendly messages", () => {
    const r = createCustomerSchema.safeParse({ name: "Amal", phone: "050 12", email: "nope" });
    const byPath = Object.fromEntries(r.error!.issues.map((i) => [i.path.join("."), i.message]));
    expect(byPath.phone).toMatch(/valid UAE number/);
    expect(byPath.email).toBe("Enter a valid email");
  });

  it("rejects unknown emirates and sources", () => {
    expect(
      createCustomerSchema.safeParse({
        name: "Amal",
        email: "amal@example.com",
        emirate: "doha",
      }).success,
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ name: "Amal", email: "amal@example.com", source: "x" })
        .success,
    ).toBe(false);
  });
});

describe("updateContactSchema", () => {
  it("builds the address JSON only when an address field is given", () => {
    const v = updateContactSchema.parse({
      id: ID,
      name: "Layla",
      phone: "+971501234567",
      email: "Layla@Example.com",
      emirate: "dubai",
      line1: "Villa 12",
      line2: "",
      area: "Jumeirah",
      city: "Dubai",
    });
    expect(v.address).toEqual({
      line1: "Villa 12",
      line2: null,
      area: "Jumeirah",
      city: "Dubai",
      emirate: "dubai",
    });
    expect(v.email).toBe("layla@example.com");
    const none = updateContactSchema.parse({ id: ID, name: "", email: "a@b.co" });
    expect(none).toMatchObject({ name: null, phone: null, address: null, email: "a@b.co" });
  });

  it("needs a phone or an email, either one", () => {
    const base = { id: ID, name: "Amal" };
    expect(updateContactSchema.safeParse({ ...base, phone: "0501234567", email: "" }).success).toBe(
      true,
    );
    expect(updateContactSchema.safeParse({ ...base, phone: "", email: "a@b.co" }).success).toBe(
      true,
    );
    const none = updateContactSchema.safeParse({ ...base, phone: "", email: "" });
    expect(none.success).toBe(false);
    expect(none.error!.issues[0].path).toEqual(["phone"]);
  });
});

describe("notes and consent", () => {
  it("blank notes clear the field", () => {
    expect(updateNotesSchema.parse({ id: ID, notes: "  " }).notes).toBeNull();
    expect(updateNotesSchema.parse({ id: ID, notes: " Prefers Capri " }).notes).toBe(
      "Prefers Capri",
    );
  });

  it("consent needs at least one known channel", () => {
    expect(recordConsentSchema.safeParse({ id: ID, channels: [] }).success).toBe(false);
    expect(recordConsentSchema.safeParse({ id: ID, channels: ["sms"] }).success).toBe(false);
    expect(recordConsentSchema.parse({ id: ID, channels: ["whatsapp"] }).channels).toEqual([
      "whatsapp",
    ]);
  });

  it("derives consent channels from the contact details", () => {
    expect(consentChannels({ phone: "+971501234567", email: "a@b.co" })).toEqual([
      "email",
      "whatsapp",
    ]);
    expect(consentChannels({ phone: null, email: "a@b.co" })).toEqual(["email"]);
  });

  it("derives the consent badge", () => {
    expect(consentState({ marketing_consent: true, unsubscribed_at: null })).toBe("opted_in");
    expect(consentState({ marketing_consent: false, unsubscribed_at: "2026-10-01" })).toBe(
      "unsubscribed",
    );
    expect(consentState({ marketing_consent: false, unsubscribed_at: null })).toBe("none");
  });
});

describe("list filters", () => {
  it("parses search params and ignores invalid values", () => {
    expect(
      parseCustomerFilters({
        q: " 050 ",
        consent: "yes",
        source: "hacker",
        emirate: ["dubai", "sharjah"],
        orders: "no",
        sort: "spent",
        page: "3",
      }),
    ).toEqual({
      q: "050",
      consent: "yes",
      source: undefined,
      emirate: "dubai",
      orders: "no",
      sort: "spent",
      page: 3,
    });
    expect(parseCustomerFilters({ page: "-2", sort: "drop table" })).toMatchObject({
      q: "",
      page: 1,
      sort: "recent",
    });
    expect(parseCustomerFilters(new URLSearchParams("q=layla&page=2"))).toMatchObject({
      q: "layla",
      page: 2,
    });
  });

  it("round-trips to a query string without defaults", () => {
    const f = parseCustomerFilters({ q: "layla", consent: "no", sort: "recent", page: "1" });
    expect(filtersToQuery(f)).toBe("q=layla&consent=no");
    expect(filtersToQuery(f, { page: 2, sort: "name" })).toBe(
      "q=layla&consent=no&sort=name&page=2",
    );
  });
});

describe("averageOrderFils", () => {
  it("rounds half-up and handles no orders", () => {
    expect(averageOrderFils(0, 0)).toBe(0);
    expect(averageOrderFils(10000, 3)).toBe(3333);
    expect(averageOrderFils(5, 2)).toBe(3);
    expect(averageOrderFils(56000, 2)).toBe(28000);
  });
});
