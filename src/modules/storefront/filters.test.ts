import { describe, expect, it } from "vitest";
import { fallbackProducts } from "./fallback";
import { filterProducts, parseShopFilters, shopHref } from "./filters";

const products = fallbackProducts();

describe("shop filters", () => {
  it("parses slugs from search params and ignores junk", () => {
    expect(parseShopFilters({ category: "perfume", destination: ["capri", "soho"] })).toEqual({
      category: "perfume",
      destination: "capri",
      sort: "featured",
    });
    expect(parseShopFilters({ category: "<script>", destination: "" })).toEqual({
      category: null,
      destination: null,
      sort: "featured",
    });
    expect(parseShopFilters({ sort: "price-asc" }).sort).toBe("price-asc");
    expect(parseShopFilters({ sort: "cheapest" }).sort).toBe("featured");
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

  it("sorts by price and name", () => {
    const prices = (sort: "price-asc" | "price-desc") =>
      filterProducts(products, { category: null, destination: null, sort }).map((p) =>
        Math.min(...p.variants.map((v) => v.priceFils)),
      );
    const asc = prices("price-asc");
    expect(asc).toEqual(asc.toSorted((a, b) => a - b));
    expect(prices("price-desc")).toEqual(asc.toReversed());
    const names = filterProducts(products, { category: null, destination: null, sort: "name" }).map(
      (p) => p.name,
    );
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b)));
  });

  it("builds canonical hrefs", () => {
    expect(shopHref({ category: null, destination: null, sort: "featured" })).toBe("/shop");
    expect(shopHref({ category: null, destination: null, sort: "name" })).toBe("/shop?sort=name");
    expect(shopHref({ category: null, destination: null })).toBe("/shop");
    expect(shopHref({ category: "perfume", destination: "capri" })).toBe(
      "/shop?category=perfume&destination=capri",
    );
    expect(shopHref({ category: null, destination: "soho" })).toBe("/shop?destination=soho");
  });
});
