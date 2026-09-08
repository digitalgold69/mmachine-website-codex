import MetalsCatalogueClient from "./MetalsCatalogueClient";
import { metalCategories } from "@/lib/metals-data";
import { getLiveMetalCatalogueProducts } from "@/lib/catalogue-products";
import { buildMetalShapeFilters } from "@/lib/metals-filters";

const INITIAL_PAGE_SIZE = 120;

export const dynamic = "force-dynamic";

export default async function MetalsCataloguePage() {
  const { products: metals } = await getLiveMetalCatalogueProducts();
  const categories = metalCategories.map((category) => ({
    ...category,
    count: metals.filter((metal) => metal.category === category.key).length,
  }));
  const shapeFiltersByCategory = Object.fromEntries(
    metalCategories.map((category) => [
      category.key,
      buildMetalShapeFilters(metals.filter((metal) => metal.category === category.key)),
    ])
  );

  return (
    <MetalsCatalogueClient
      initialProducts={metals.slice(0, INITIAL_PAGE_SIZE)}
      initialCount={metals.length}
      total={metals.length}
      categories={categories}
      shapeFiltersByCategory={shapeFiltersByCategory}
    />
  );
}
