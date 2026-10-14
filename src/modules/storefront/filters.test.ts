import { describe, expect, it } from "vitest";
import { fallbackProducts } from "./fallback";
import { filterProducts, parseShopFilters, shopHref } from "./filters";

const products = fallbackProducts();

describe("shop filters", () => {
  it("parses slugs from search params and ignores junk", () => {
    expect(parseShopFilters({ category: "perfume", destination: ["capri", "soho"] })).toEqual({
      category: "perfume",
      destination: "capri",
    });
    expect(parseShopFilters({ category: "<script>", destination: "" })).toEqual({
      category: null,
      destination: null,
    });
    expect(parseShopFilters({})).toEqual({ category: null, destination: null });
  });

  it("filters by category and destination", () => {
    expect(filterProducts(products, { category: null, destination: null })).toHaveLength(8);
    expect(filterProducts(products, { category: "perfume", destination: null })).toHaveLength(5);
    expect(
      filterProducts(products, { category: "all_over_spray", destination: null }).map(
        (p) => p.destination?.slug,
      ),
    ).toEqual(["soho", "monaco", "mayfair"]);
    expect(
      filterProducts(products, { category: null, destination: "capri" }).map((p) => p.slug),
    ).toEqual(["capri-perfume"]);
    expect(filterProducts(products, { category: "all_over_spray", destination: "capri" })).toEqual(
      [],
    );
  });

  it("builds canonical hrefs", () => {
    expect(shopHref({ category: null, destination: null })).toBe("/shop");
    expect(shopHref({ category: "perfume", destination: "capri" })).toBe(
      "/shop?category=perfume&destination=capri",
    );
    expect(shopHref({ category: null, destination: "soho" })).toBe("/shop?destination=soho");
  });
});
