import type { MetadataRoute } from "next";
import {
  IS_PREVIEW_DEPLOYMENT,
  SITE_URL,
  getAllSeoCategories,
  getAllSeoProducts,
  productUrl,
} from "@/lib/seo";
import { guideUrl, guides } from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  if (IS_PREVIEW_DEPLOYMENT) return [];

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/parts`, priority: 0.95 },
    { url: `${SITE_URL}/machines`, priority: 0.8 },
    { url: `${SITE_URL}/machines/classic-mini`, priority: 0.85 },
    { url: `${SITE_URL}/custom-engineering`, priority: 0.85 },
    { url: `${SITE_URL}/featured`, priority: 0.7 },
    { url: `${SITE_URL}/articles`, priority: 0.78 },
    { url: `${SITE_URL}/about`, priority: 0.7 },
    { url: `${SITE_URL}/contact`, priority: 0.7 },
    { url: `${SITE_URL}/privacy`, priority: 0.3 },
  ];

  const categoryPages: MetadataRoute.Sitemap = getAllSeoCategories().map((category) => ({
    url: `${SITE_URL}/parts/${category.slug}`,
    priority: category.kind.endsWith("index") ? 0.9 : 0.82,
  }));

  const productPages: MetadataRoute.Sitemap = getAllSeoProducts().map((product) => ({
    url: `${SITE_URL}${productUrl(product)}`,
    priority: 0.64,
  }));

  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${SITE_URL}${guideUrl(guide)}`,
    lastModified: guide.publishedAt,
    priority: 0.72,
  }));

  return [...staticPages, ...categoryPages, ...productPages, ...guidePages];
}
