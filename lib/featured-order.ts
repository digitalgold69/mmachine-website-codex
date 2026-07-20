import type { FeaturedWork } from "@/lib/featured";
import type { QuoteItem } from "@/lib/quote-types";

export function featuredOrderItem(job: FeaturedWork): Omit<QuoteItem, "qty"> {
  return {
    key: `featured-${job.id}`,
    catalogue: "featured",
    productId: job.id,
    code: `FW-${job.id.toUpperCase()}`,
    description: job.title,
    unit: "each",
    unitPriceExVat: job.priceExVat,
    unitPriceIncVat:
      typeof job.priceExVat === "number" ? Number((job.priceExVat * 1.2).toFixed(2)) : null,
  };
}
