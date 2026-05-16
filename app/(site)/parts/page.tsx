import Link from "next/link";
import type { Metadata } from "next";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  getAllSeoCategories,
  jsonLdScript,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Classic Mini Parts & Engineering Metals Catalogue",
  description:
    "Browse M-Machine Classic Mini pressed panels and engineering metals with crawlable category pages, product pages and quote enquiry links.",
  alternates: { canonical: absoluteUrl("/parts") },
  openGraph: {
    title: "Classic Mini Parts & Engineering Metals Catalogue | M-Machine",
    description:
      "Classic Mini panels, repair sections and engineering metals from M-Machine in Darlington.",
    url: absoluteUrl("/parts"),
    type: "website",
  },
};

export default function PartsIndexPage() {
  const categories = getAllSeoCategories();
  const miniCategories = categories.filter((category) => category.kind === "mini-section");
  const metalCategories = categories.filter((category) => category.kind === "metal-category");

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Parts", path: "/parts" },
  ]);

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "M-Machine parts catalogue",
    description: metadata.description,
    url: absoluteUrl("/parts"),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(collection)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <span>Parts</span>
      </nav>

      <header className="mb-10 max-w-3xl">
        <h1 className="font-display text-4xl text-racing mb-3">
          Classic Mini parts and engineering metals
        </h1>
        <p className="text-ink-muted leading-relaxed">
          Use these indexable catalogue pages to browse Classic Mini restoration panels and engineering metal stock.
          Each category links through to individual part pages with product details, enquiry links and related parts.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-6 mb-10">
        <Link href="/parts/classic-mini-panels" className="card bg-white block group">
          <p className="text-xs font-semibold tracking-wider text-gold mb-2">CLASSIC MINI</p>
          <h2 className="font-display text-2xl text-racing mb-2">Classic Mini panels</h2>
          <p className="text-sm text-ink-muted mb-4">
            Pressed steel repair panels organised by the same sections as the customer catalogue.
          </p>
          <span className="text-sm font-semibold text-racing group-hover:text-gold">Browse Mini panels</span>
        </Link>

        <Link href="/parts/engineering-metals" className="card bg-white block group">
          <p className="text-xs font-semibold tracking-wider text-gold mb-2">METALS</p>
          <h2 className="font-display text-2xl text-racing mb-2">Engineering metals</h2>
          <p className="text-sm text-ink-muted mb-4">
            Aluminium, tool steel, stainless, brass, bronze, copper, plastics and other material lines.
          </p>
          <span className="text-sm font-semibold text-racing group-hover:text-gold">Browse metals</span>
        </Link>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-2xl text-racing mb-4">Classic Mini panel sections</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {miniCategories.map((category) => (
              <Link key={category.slug} href={`/parts/${category.slug}`} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
              <span className="font-mono text-sm text-gold">
                {category.kind === "mini-section" ? category.section.code : ""}
              </span>
              <h3 className="font-semibold text-racing">{category.title}</h3>
              <p className="text-xs text-ink-muted mt-1">{category.products.length} parts</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-2xl text-racing mb-4">Engineering metal categories</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {metalCategories.map((category) => (
              <Link key={category.slug} href={`/parts/${category.slug}`} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
              <h3 className="font-semibold text-racing">{category.title}</h3>
              <p className="text-xs text-ink-muted mt-1">{category.products.length} catalogue lines</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-cream-dark border-l-4 border-gold p-6">
        <h2 className="font-display text-xl text-racing mb-2">Not sure what you need?</h2>
        <p className="text-sm text-ink-muted mb-3">
          Send a part number, photo, drawing or metal specification and the M-Machine team will help identify the right item.
        </p>
        <Link href="/contact" className="text-sm font-semibold text-racing hover:text-gold">
          Contact us about a part
        </Link>
      </section>
    </div>
  );
}
