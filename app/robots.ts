import type { MetadataRoute } from "next";

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
    sitemap: "https://m-machine-metals.co.uk/sitemap.xml",
  };
}
