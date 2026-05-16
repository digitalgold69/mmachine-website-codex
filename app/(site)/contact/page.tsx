import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import ContactForm from "@/components/ContactForm";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact M-Machine",
  description:
    "Contact M-Machine in Darlington for Classic Mini panels, engineering metals, custom fabrication and part-number enquiries.",
  alternates: { canonical: absoluteUrl("/contact") },
  openGraph: {
    title: "Contact M-Machine | Classic Mini Panels & Metals",
    description:
      "Send a part enquiry, quote request or metals specification to M-Machine in Darlington.",
    url: absoluteUrl("/contact"),
    type: "website",
  },
};

export default function ContactPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Contact", path: "/contact" },
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <span>Contact</span>
      </nav>

      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-4xl text-racing mt-2 mb-3">Get in touch</h1>
        <p className="text-ink-muted">
          Place an order, ask for a quote, or get material advice. The fastest route is always a phone call,
          but the enquiry form can include product names, part numbers and page URLs automatically.
        </p>
      </header>

      <Suspense fallback={<div className="rounded-xl bg-white border border-racing/10 p-6 text-sm text-ink-muted">Loading enquiry form...</div>}>
        <ContactForm />
      </Suspense>
    </div>
  );
}
