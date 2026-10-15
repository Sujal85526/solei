/** "Eau de parfum" / "All over spray" — a product's kind, shown under its name. */
export function productTypeLabel(category: { slug: string; name: string }): string {
  switch (category.slug) {
    case "perfume":
      return "Eau de parfum";
    case "all_over_spray":
      return "All over spray";
    default:
      return category.name;
  }
}
