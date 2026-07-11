import MetalsCatalogueClient from "./MetalsCatalogueClient";
import { metalCategories, metals } from "@/lib/metals-data";

const INITIAL_PAGE_SIZE = 120;

export default function MetalsCataloguePage() {
  const categories = metalCategories.map((category) => ({
    ...category,
    count: metals.filter((metal) => metal.category === category.key).length,
  }));

  return (
    <MetalsCatalogueClient
      initialProducts={metals.slice(0, INITIAL_PAGE_SIZE)}
      initialCount={metals.length}
      total={metals.length}
      categories={categories}
    />
  );
}
