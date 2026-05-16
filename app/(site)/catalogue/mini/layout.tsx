import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Interactive Classic Mini Panels Catalogue",
  description:
    "Interactive Classic Mini panels catalogue from M-Machine, with 3D section selector, part numbers, prices and quote ordering.",
  alternates: { canonical: absoluteUrl("/parts/classic-mini-panels") },
  openGraph: {
    title: "Interactive Classic Mini Panels Catalogue | M-Machine",
    description:
      "Browse M-Machine Classic Mini pressed panel sections with the interactive 3D Mini selector.",
    url: absoluteUrl("/catalogue/mini"),
    type: "website",
  },
};

export default function MiniCatalogueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
