import type { StoreProduct } from "./types";

/** Shop filters carried in the URL (`/shop?category=perfume&destination=capri`). */
export type ShopFilters = { category: string | null; destination: string | null };

const slug = (v: unknown): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && /^[a-z0-9_-]{1,64}$/.test(s) ? s : null;
};

export function parseShopFilters(
  params: Record<string, string | string[] | undefined>,
): ShopFilters {
  return { category: slug(params.category), destination: slug(params.destination) };
}

export function filterProducts(products: StoreProduct[], f: ShopFilters): StoreProduct[] {
  return products.filter(
    (p) =>
      (!f.category || p.category.slug === f.category) &&
      (!f.destination || p.destination?.slug === f.destination),
  );
}

export function shopHref(f: ShopFilters): string {
  const qs = new URLSearchParams();
  if (f.category) qs.set("category", f.category);
  if (f.destination) qs.set("destination", f.destination);
  const s = qs.toString();
  return s ? `/shop?${s}` : "/shop";
}
