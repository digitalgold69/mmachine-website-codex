import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Interactive Engineering Metals Catalogue",
  description:
    "Interactive engineering metals catalogue from M-Machine, with metal, shape, specification, size, unit and price columns.",
  alternates: { canonical: absoluteUrl("/parts/engineering-metals") },
  openGraph: {
    title: "Interactive Engineering Metals Catalogue | M-Machine",
    description:
      "Browse M-Machine engineering metals in the same column format as the customer PDF catalogue.",
    url: absoluteUrl("/catalogue/metals"),
    type: "website",
  },
};

export default function MetalsCatalogueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
