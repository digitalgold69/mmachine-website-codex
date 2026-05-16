import { metalCategories, metals, type MetalProduct } from "@/lib/metals-data";
import { products, sections, type Product, type Section } from "@/lib/mini-data";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://m-machine-metals.co.uk";

export const SITE_URL = configuredSiteUrl.replace(/\/+$/, "");
export const DEFAULT_OG_IMAGE = "/og-image.jpg";

export type SeoProduct =
  | { kind: "mini"; product: Product }
  | { kind: "metal"; product: MetalProduct };

export type SeoCategory =
  | {
      kind: "mini-index";
      slug: string;
      title: string;
      description: string;
      products: Product[];
      sections: Section[];
    }
  | {
      kind: "mini-section";
      slug: string;
      section: Section;
      title: string;
      description: string;
      products: Product[];
    }
  | {
      kind: "metals-index";
      slug: string;
      title: string;
      description: string;
      products: MetalProduct[];
    }
  | {
      kind: "metal-category";
      slug: string;
      key: string;
      label: string;
      title: string;
      description: string;
      products: MetalProduct[];
    };

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function miniSectionSlug(section: Section) {
  return `classic-mini-${section.code}-${slugify(section.label)}`;
}

export function metalCategorySlug(category: { key: string; label: string }) {
  return `metals-${slugify(category.label || category.key)}`;
}

export function productSlug(item: SeoProduct) {
  if (item.kind === "mini") {
    return `mini-${item.product.id}-${slugify(`${item.product.code}-${item.product.name}`)}`;
  }

  return `metal-${item.product.id}-${slugify([item.product.form, item.product.metal, item.product.spec, item.product.size].filter(Boolean).join("-"))}`;
}

export function productUrl(item: SeoProduct) {
  return `/products/${productSlug(item)}`;
}

export function categoryUrl(category: SeoCategory) {
  return `/parts/${category.slug}`;
}

export function getAllSeoCategories(): SeoCategory[] {
  return [
    {
      kind: "mini-index",
      slug: "classic-mini-panels",
      title: "Classic Mini panels",
      description: `${products.length} Classic Mini pressed steel panels for restoration and repair, organised by catalogue section.`,
      products,
      sections,
    },
    ...sections.map((section): SeoCategory => {
      const sectionProducts = products.filter((product) => product.section === section.code);
      return {
        kind: "mini-section",
        slug: miniSectionSlug(section),
        section,
        title: `Classic Mini ${section.label.toLowerCase()} panels`,
        description: `${section.label} parts for Classic Mini restoration, including ${section.subtitle.toLowerCase()}.`,
        products: sectionProducts,
      };
    }),
    {
      kind: "metals-index",
      slug: "engineering-metals",
      title: "Engineering metals",
      description: `${metals.length} engineering metal catalogue lines including aluminium, stainless steel, tool steels, brass, bronze and plastics.`,
      products: metals,
    },
    ...metalCategories.map((category): SeoCategory => {
      const categoryProducts = metals.filter((product) => product.category === category.key);
      return {
        kind: "metal-category",
        slug: metalCategorySlug(category),
        key: category.key,
        label: category.label,
        title: `${category.label} cut metal stock`,
        description: `${category.label} engineering metal stock from M-Machine, available to enquire by shape, specification and size.`,
        products: categoryProducts,
      };
    }),
  ];
}

export function getSeoCategory(slug: string) {
  return getAllSeoCategories().find((category) => category.slug === slug);
}

export function getAllSeoProducts(): SeoProduct[] {
  return [
    ...products.map((product): SeoProduct => ({ kind: "mini", product })),
    ...metals.map((product): SeoProduct => ({ kind: "metal", product })),
  ];
}

export function getSeoProduct(slug: string) {
  const [kind, id] = slug.split("-");
  if (kind === "mini") {
    const product = products.find((item) => item.id === id);
    return product ? ({ kind: "mini", product } satisfies SeoProduct) : undefined;
  }
  if (kind === "metal") {
    const product = metals.find((item) => item.id === id);
    return product ? ({ kind: "metal", product } satisfies SeoProduct) : undefined;
  }
  return undefined;
}

export function productName(item: SeoProduct) {
  return item.kind === "mini"
    ? item.product.name
    : [item.product.form, item.product.metal, item.product.spec, item.product.size].filter(Boolean).join(" - ");
}

export function productSku(item: SeoProduct) {
  return item.kind === "mini" ? item.product.code : item.product.code;
}

export function productCategory(item: SeoProduct) {
  if (item.kind === "mini") {
    const section = sections.find((entry) => entry.code === item.product.section);
    return section
      ? getSeoCategory(miniSectionSlug(section))
      : getSeoCategory("classic-mini-panels");
  }

  const category = metalCategories.find((entry) => entry.key === item.product.category);
  return category
    ? getSeoCategory(metalCategorySlug(category))
    : getSeoCategory("engineering-metals");
}

export function productMetaDescription(item: SeoProduct) {
  if (item.kind === "mini") {
    const section = productCategory(item);
    const fits = [item.product.fits, item.product.mark, item.product.bodyType].filter(Boolean).join(", ");
    return `${item.product.name}${item.product.code ? ` (${item.product.code})` : ""}, listed in ${section?.title || "Classic Mini panels"}. ${fits ? `Fits: ${fits}. ` : ""}Request a quote from M-Machine.`;
  }

  const p = item.product;
  return `${productName(item)} from the M-Machine metals catalogue. Spec ${p.spec || "available on request"}, size ${p.size || "available on request"}, unit ${p.unit || "on enquiry"}.`;
}

export function relatedProducts(item: SeoProduct, limit = 6) {
  if (item.kind === "mini") {
    return products
      .filter((product) => product.section === item.product.section && product.id !== item.product.id)
      .slice(0, limit)
      .map((product): SeoProduct => ({ kind: "mini", product }));
  }

  return metals
    .filter((product) => product.category === item.product.category && product.id !== item.product.id)
    .slice(0, limit)
    .map((product): SeoProduct => ({ kind: "metal", product }));
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
