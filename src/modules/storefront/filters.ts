import type { StoreProduct } from "./types";

export const SHOP_SORTS = ["featured", "price-asc", "price-desc"] as const;
/** The sorts offered in the shop's Filter panel ("featured" is the default when none is chosen). */
export const PRICE_SORTS = ["price-asc", "price-desc"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

/** Shop filters carried in the URL (`/shop?category=perfume&sort=price-asc`). */
export type ShopFilters = {
  category: string | null;
  destination: string | null;
  sort?: ShopSort;
};

const slug = (v: unknown): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && /^[a-z0-9_-]{1,64}$/.test(s) ? s : null;
};

const sortOf = (v: unknown): ShopSort => {
  const s = Array.isArray(v) ? v[0] : v;
  return (SHOP_SORTS as readonly unknown[]).includes(s) ? (s as ShopSort) : "featured";
};

export function parseShopFilters(
  params: Record<string, string | string[] | undefined>,
): Required<ShopFilters> {
  return {
    category: slug(params.category),
    destination: slug(params.destination),
    sort: sortOf(params.sort),
  };
}

const fromPrice = (p: StoreProduct) => Math.min(...p.variants.map((v) => v.priceFils));

/** Filters, then sorts (catalogue order for "featured", featured products first). */
export function filterProducts(products: StoreProduct[], f: ShopFilters): StoreProduct[] {
  const list = products.filter(
    (p) =>
      (!f.category || p.category.slug === f.category) &&
      (!f.destination || p.destination?.slug === f.destination),
  );
  switch (f.sort ?? "featured") {
    case "price-asc":
      return list.toSorted((a, b) => fromPrice(a) - fromPrice(b));
    case "price-desc":
      return list.toSorted((a, b) => fromPrice(b) - fromPrice(a));
    default:
      return list.toSorted((a, b) => Number(b.featured) - Number(a.featured));
  }
}

export function shopHref(f: ShopFilters): string {
  const qs = new URLSearchParams();
  if (f.category) qs.set("category", f.category);
  if (f.destination) qs.set("destination", f.destination);
  if (f.sort && f.sort !== "featured") qs.set("sort", f.sort);
  const s = qs.toString();
  return s ? `/shop?${s}` : "/shop";
}
