import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { DEFAULT_OG_IMAGE, IS_PREVIEW_DEPLOYMENT, SITE_URL, absoluteUrl, jsonLdScript } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "M-Machine | Classic Mini Panels & Engineering Metals | Est. 1980",
    template: "%s | M-Machine",
  },
  description:
    "Specialist suppliers of classic Mini pressed steel panels, engineering metals and bespoke fabrication. Family-run from Darlington since 1980.",
  keywords: [
    "classic mini panels",
    "mini spare parts",
    "pressed steel panels",
    "engineering metals UK",
    "tool steel Darlington",
    "mini restoration parts",
    "bespoke metal fabrication",
    "M-Machine",
  ],
  authors: [{ name: "M-Machine (Craftgrange Limited)" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: SITE_URL,
    siteName: "M-Machine",
    title: "M-Machine | Classic Mini Panels & Engineering Metals",
    description:
      "Four decades supplying classic Mini panels, engineering metals and bespoke fabrication from our Darlington workshop.",
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1600, height: 1200, alt: "Custom engineering work at M-Machine" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "M-Machine | Classic Mini Panels & Engineering Metals",
    description:
      "Classic Mini panels, tool steels, stainless and bespoke fabrication. Est. 1980.",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  icons: {
    icon: [{ url: "/brand/m-machine-butterfly.png", type: "image/png" }],
    apple: [{ url: "/brand/m-machine-butterfly.png" }],
  },
  robots: {
    index: !IS_PREVIEW_DEPLOYMENT,
    follow: !IS_PREVIEW_DEPLOYMENT,
    googleBot: { index: !IS_PREVIEW_DEPLOYMENT, follow: !IS_PREVIEW_DEPLOYMENT, "max-image-preview": "large" },
  },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organization = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${SITE_URL}/#business`,
    name: "M-Machine",
    legalName: "Craftgrange Limited",
    url: SITE_URL,
    email: "sales@m-machine.co.uk",
    telephone: "01325 381302",
    logo: absoluteUrl("/brand/m-machine-butterfly.png"),
    sameAs: ["https://www.facebook.com/p/M-Machine-61568650964800/"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Unit 6 Forge Way, Cleveland Trading Estate",
      addressLocality: "Darlington",
      addressRegion: "County Durham",
      postalCode: "DL1 2PJ",
      addressCountry: "GB",
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "M-Machine",
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#business` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en-GB" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organization)} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(website)} />
      </head>
      <body>{children}</body>
    </html>
  );
}
