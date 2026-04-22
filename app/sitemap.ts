import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://m-machine-metals.co.uk";
  return [
    { url: base, lastModified: new Date(), priority: 1 },
    { url: `${base}/catalogue/mini`, lastModified: new Date(), priority: 0.9 },
    { url: `${base}/catalogue/metals`, lastModified: new Date(), priority: 0.9 },
    { url: `${base}/featured`, lastModified: new Date(), priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), priority: 0.7 },
    { url: `${base}/contact`, lastModified: new Date(), priority: 0.7 },
  ];
}
