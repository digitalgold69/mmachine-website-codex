import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://m-machine-metals.co.uk"),
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
    url: "https://m-machine-metals.co.uk",
    siteName: "M-Machine",
    title: "M-Machine | Classic Mini Panels & Engineering Metals",
    description:
      "Four decades supplying classic Mini panels, engineering metals and bespoke fabrication from our Darlington workshop.",
  },
  twitter: {
    card: "summary_large_image",
    title: "M-Machine | Classic Mini Panels & Engineering Metals",
    description:
      "Classic Mini panels, tool steels, stainless and bespoke fabrication. Est. 1980.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "https://m-machine-metals.co.uk" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
