import type { Database } from "@/lib/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type QuoteStatus = Database["public"]["Enums"]["booking_quote_status"];
export type Emirate = Database["public"]["Enums"]["emirate"];

/** Everything the public wizard needs — all of it admin-editable (BUILD_PROMPT §6.10). */
export type BookingConfig = {
  eventTypes: { id: string; name: string }[];
  services: { id: string; name: string; description: string | null }[];
  packages: {
    id: string;
    name: string;
    description: string | null;
    inclusions: string[];
    basePriceFils: number;
    images: string[];
  }[];
  booths: { id: string; name: string; description: string | null; photos: string[] }[];
  flowers: { id: string; name: string; hex: string; priceFils: number }[];
  /** Flower decoration base price; each colour adds its own surcharge. */
  flowerBaseFils: number;
  depositBp: number;
  /** Product categories of interest with their lowest active price (null = priced in the quote). */
  products: { category: string; name: string; fromPriceFils: number | null }[];
};

export type ProductInterest = { category: string; qty: number };

export type EstimateLine = {
  kind: "package" | "flowers" | "products";
  label: string;
  qty: number;
  category?: string;
  unitPriceFils: number | null;
  totalFils: number | null;
};

export type Estimate = { lines: EstimateLine[]; totalFils: number };

export type QuoteLine = { label: string; qty: number; unitPriceFils: number; totalFils: number };
