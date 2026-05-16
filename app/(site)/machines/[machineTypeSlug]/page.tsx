import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { products, sections } from "@/lib/mini-data";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  getSeoCategory,
  jsonLdScript,
  miniSectionSlug,
  productSlug,
} from "@/lib/seo";

type PageProps = {
  params: Promise<{ machineTypeSlug: string }>;
};

export function generateStaticParams() {
  return [{ machineTypeSlug: "classic-mini" }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { machineTypeSlug } = await params;
  if (machineTypeSlug !== "classic-mini") return {};

  return {
    title: "Classic Mini Parts, Panels & Repair Sections",
    description:
      "Browse Classic Mini repair panels and restoration parts from M-Machine, organised by Mini catalogue section with part-number pages.",
    alternates: { canonical: absoluteUrl("/machines/classic-mini") },
    openGraph: {
      title: "Classic Mini Parts, Panels & Repair Sections | M-Machine",
      description:
        "Classic Mini pressed steel panels and repair sections from M-Machine in Darlington.",
      url: absoluteUrl("/machines/classic-mini"),
      type: "website",
    },
  };
}

export default async function MachinePage({ params }: PageProps) {
  const { machineTypeSlug } = await params;
  if (machineTypeSlug !== "classic-mini") notFound();

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Machines", path: "/machines/classic-mini" },
    { name: "Classic Mini", path: "/machines/classic-mini" },
  ]);

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Classic Mini parts",
    description: "Classic Mini pressed steel panels and repair sections from M-Machine.",
    url: absoluteUrl("/machines/classic-mini"),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(collection)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <span>Classic Mini</span>
      </nav>

      <header className="mb-10 max-w-3xl">
        <h1 className="font-display text-4xl text-racing mb-3">Classic Mini parts and panels</h1>
        <p className="text-ink-muted leading-relaxed">
          M-Machine supplies Classic Mini pressed steel panels, restoration repair sections and related parts for Mk1 through later Mini models.
          Use this machine page to reach the right section, part number or enquiry route.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="font-display text-2xl text-racing mb-4">Classic Mini panel sections</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((section) => {
            const category = getSeoCategory(miniSectionSlug(section));
            return (
              <Link key={section.code} href={category ? `/parts/${category.slug}` : "/parts/classic-mini-panels"} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
                <span className="font-mono text-sm text-gold">{section.code}</span>
                <h3 className="font-semibold text-racing">{section.label}</h3>
                <p className="text-xs text-ink-muted mt-1">{section.subtitle}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
          <h2 className="font-display text-2xl text-racing">Popular Classic Mini catalogue items</h2>
          <Link href="/parts/classic-mini-panels" className="text-sm font-semibold text-racing hover:text-gold">
            View all Mini panels
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.slice(0, 18).map((product) => (
            <Link key={product.id} href={`/products/${productSlug({ kind: "mini", product })}`} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
              <h3 className="font-semibold text-racing leading-snug">{product.name}</h3>
              <p className="mt-1 font-mono text-xs text-ink-muted">{product.code}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-cream-dark border-l-4 border-gold p-6">
        <h2 className="font-display text-xl text-racing mb-2">Need help identifying a Mini panel?</h2>
        <p className="text-sm text-ink-muted mb-3">
          Send the part number, model details or a photo and M-Machine will help match the correct repair panel.
        </p>
        <Link href="/contact?category=Classic%20Mini%20panels" className="text-sm font-semibold text-racing hover:text-gold">
          Ask about Classic Mini parts
        </Link>
      </section>
    </div>
  );
}
