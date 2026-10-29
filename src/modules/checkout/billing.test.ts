import { describe, expect, it } from "vitest";
import { billingFromOrder } from "./billing";

describe("billingFromOrder", () => {
  it("maps the account name and delivery address", () => {
    expect(
      billingFromOrder({
        contact_name: "Sara Al Mansoori",
        delivery_address: { line1: "Villa 12", line2: "", area: "Saadiyat", city: "Abu Dhabi" },
        delivery_emirate: "abu_dhabi",
      }),
    ).toEqual({
      firstName: "Sara",
      lastName: "Al Mansoori",
      address1: "Villa 12, Saadiyat",
      city: "Abu Dhabi",
    });
  });

  it("uses the emirate as the city when there is no city", () => {
    expect(
      billingFromOrder({
        contact_name: "Omar",
        delivery_address: { line1: "Tower 3, Apt 1203" },
        delivery_emirate: "dubai",
      }),
    ).toMatchObject({ firstName: "Omar", lastName: "", city: "Dubai" });
  });

  it("copes with orders that have no address at all", () => {
    expect(
      billingFromOrder({ contact_name: null, delivery_address: null, delivery_emirate: null }),
    ).toEqual({ firstName: "", lastName: "", address1: "", city: "Abu Dhabi" });
  });
});
