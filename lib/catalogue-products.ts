import { products as generatedMiniProducts, type Product } from "@/lib/mini-data";
import { metals as generatedMetals, type MetalProduct } from "@/lib/metals-data";
import { listManualMiniProducts } from "@/lib/manual-mini-products";
import { getCatalogueOverrideProducts, type CatalogueOverrideMeta } from "@/lib/catalogue-overrides";
import { normaliseCatalogueProductPrices } from "@/lib/catalogue-pricing";

export type LiveMiniCatalogue = {
  products: Product[];
  catalogueProductCount: number;
  override: CatalogueOverrideMeta | null;
};

export type LiveMetalsCatalogue = {
  products: MetalProduct[];
  override: CatalogueOverrideMeta | null;
};

export async function getLiveMiniCatalogueProducts(options: { includeManual?: boolean } = {}): Promise<LiveMiniCatalogue> {
  let baseProducts = normaliseCatalogueProductPrices(generatedMiniProducts);
  let override: CatalogueOverrideMeta | null = null;

  try {
    const uploaded = await getCatalogueOverrideProducts<Product>("mini");
    if (uploaded?.products?.length) {
      baseProducts = normaliseCatalogueProductPrices(uploaded.products);
      override = uploaded.meta;
    }
  } catch (error) {
    console.error("mini_catalogue_override_unavailable", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  const catalogueProductCount = baseProducts.length;
  if (!options.includeManual) {
    return { products: baseProducts, catalogueProductCount, override };
  }

  try {
    const manualProducts = await listManualMiniProducts({ activeOnly: true });
    return {
      products: [...baseProducts, ...normaliseCatalogueProductPrices(manualProducts)],
      catalogueProductCount,
      override,
    };
  } catch (error) {
    console.error("manual_mini_products_unavailable", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { products: baseProducts, catalogueProductCount, override };
  }
}

export async function getLiveMetalCatalogueProducts(): Promise<LiveMetalsCatalogue> {
  try {
    const uploaded = await getCatalogueOverrideProducts<MetalProduct>("metals");
    if (uploaded?.products?.length) {
      return { products: normaliseCatalogueProductPrices(uploaded.products), override: uploaded.meta };
    }
  } catch (error) {
    console.error("metals_catalogue_override_unavailable", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  return { products: normaliseCatalogueProductPrices(generatedMetals), override: null };
}
