import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/account/",
          "/login/",
          "/*?sort=",
          "/*?filter=",
          "/*?utm_",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
