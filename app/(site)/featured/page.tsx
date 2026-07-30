import Link from "next/link";
import { featuredWork as fallbackFeaturedWork } from "@/lib/featured-data";
import { listFeaturedWork } from "@/lib/featured";
import type { Metadata } from "next";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, openGraphImage } from "@/lib/seo";
import FeaturedWorkGrid from "@/components/FeaturedWorkGrid";

export const metadata: Metadata = {
  title: "Featured Work",
  description: "Order from a selection of featured fabrication, machining and engineering work by M-Machine.",
  alternates: { canonical: absoluteUrl("/featured") },
  openGraph: {
    title: "Featured Work | M-Machine",
    description: "Order from a selection of featured fabrication, machining and engineering work by M-Machine.",
    url: absoluteUrl("/featured"),
    type: "website",
    images: openGraphImage("/custom-engineering/custom-fabrication-cam.jpg", "Custom engineering work at M-Machine"),
  },
};

export const dynamic = "force-dynamic";

export default async function FeaturedPage() {
  let featuredWork = fallbackFeaturedWork;
  try {
    featuredWork = await listFeaturedWork();
  } catch {
    featuredWork = fallbackFeaturedWork;
  }

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Featured Work", path: "/featured" },
  ]);

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Featured Work",
    description: metadata.description,
    url: absoluteUrl("/featured"),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(collection)} />

      <div className="mb-10">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">&larr; Home</Link>
        <h1 className="font-display text-4xl text-racing mt-2 mb-2">Featured Work</h1>
        <p className="text-ink-muted max-w-2xl">
          Browse recent fabrication, machining and engineering work. Order an item shown here,
          or use it as a starting point and tell us what you need changed.
        </p>
      </div>

      <div className="mb-12">
        <FeaturedWorkGrid
          items={featuredWork}
          emptyText="New Featured Work will appear here as it is added."
          gridClassName="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          cardImageClassName="aspect-[16/10]"
        />
      </div>

      <section className="bg-racing text-cream rounded-2xl p-10 text-center">
        <h2 className="font-display text-2xl mb-3">Got a project in mind?</h2>
        <p className="opacity-80 mb-6 max-w-2xl mx-auto">
          We love taking on unusual jobs. Send us a drawing, a photo, or just describe what you need,
          and one of our engineers will come back to you with a quote.
        </p>
        <Link href="/custom-engineering" className="btn-gold">
          Start a bespoke enquiry &rarr;
        </Link>
      </section>
    </div>
  );
}
