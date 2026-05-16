import type { MetadataRoute } from "next";
import {
  SITE_URL,
  getAllSeoCategories,
  getAllSeoProducts,
  productUrl,
} from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, priority: 1 },
    { url: `${SITE_URL}/parts`, lastModified, priority: 0.95 },
    { url: `${SITE_URL}/machines/classic-mini`, lastModified, priority: 0.85 },
    { url: `${SITE_URL}/catalogue/mini`, lastModified, priority: 0.75 },
    { url: `${SITE_URL}/catalogue/metals`, lastModified, priority: 0.75 },
    { url: `${SITE_URL}/featured`, lastModified, priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified, priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified, priority: 0.7 },
  ];

  const categoryPages: MetadataRoute.Sitemap = getAllSeoCategories().map((category) => ({
    url: `${SITE_URL}/parts/${category.slug}`,
    lastModified,
    priority: category.kind.endsWith("index") ? 0.9 : 0.82,
  }));

  const productPages: MetadataRoute.Sitemap = getAllSeoProducts().map((product) => ({
    url: `${SITE_URL}${productUrl(product)}`,
    lastModified,
    priority: 0.64,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
