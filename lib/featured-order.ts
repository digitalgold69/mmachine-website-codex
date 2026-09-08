import type { FeaturedWork } from "@/lib/featured";
import type { QuoteItem } from "@/lib/quote-types";
import { normaliseCataloguePrice } from "@/lib/catalogue-pricing";

export function featuredOrderItem(job: FeaturedWork): Omit<QuoteItem, "qty"> {
  const priceExVat = normaliseCataloguePrice(job.priceExVat);
  return {
    key: `featured-${job.id}`,
    catalogue: "featured",
    productId: job.id,
    code: `MS-${job.id.toUpperCase()}`,
    description: job.title,
    unit: "each",
    unitPriceExVat: priceExVat,
    unitPriceIncVat:
      typeof priceExVat === "number" ? Number((priceExVat * 1.2).toFixed(2)) : null,
  };
}
