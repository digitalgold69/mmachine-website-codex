import type { MetalProduct } from "@/lib/metals-data";

export type MetalShapeFilter = {
  key: string;
  label: string;
  count: number;
};

export function metalShapeKey(value: unknown) {
  const key = String(value || "Other")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || "other";
}

export function buildMetalShapeFilters(products: MetalProduct[]): MetalShapeFilter[] {
  const filters = new Map<string, MetalShapeFilter>();
  for (const product of products) {
    const label = String(product.form || "Other").trim() || "Other";
    const key = metalShapeKey(label);
    const existing = filters.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      filters.set(key, { key, label, count: 1 });
    }
  }
  return [...filters.values()];
}
