export function normaliseCataloguePrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function hasCataloguePrice(value: number | null | undefined): value is number {
  return normaliseCataloguePrice(value) !== null;
}

export function catalogueMoney(value: number | null | undefined) {
  const price = normaliseCataloguePrice(value);
  return price === null ? "POA" : `\u00a3${price.toFixed(2)}`;
}

export function normaliseCatalogueProductPrices<
  T extends { priceExVat: number | null; priceIncVat: number | null },
>(products: T[]): T[] {
  return products.map((product) => {
    const priceExVat = normaliseCataloguePrice(product.priceExVat);
    const priceIncVat = normaliseCataloguePrice(product.priceIncVat);
    if (priceExVat === product.priceExVat && priceIncVat === product.priceIncVat) return product;
    return { ...product, priceExVat, priceIncVat };
  });
}
