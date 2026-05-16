import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  categoryUrl,
  getAllSeoCategories,
  getSeoCategory,
  jsonLdScript,
  productSlug,
  type SeoCategory,
} from "@/lib/seo";
import type { MetalProduct } from "@/lib/metals-data";
import type { Product } from "@/lib/mini-data";

type PageProps = {
  params: Promise<{ categorySlug: string }>;
};

export function generateStaticParams() {
  return getAllSeoCategories().map((category) => ({ categorySlug: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = getSeoCategory(categorySlug);
  if (!category) return {};

  return {
    title: category.title,
    description: category.description,
    alternates: { canonical: absoluteUrl(categoryUrl(category)) },
    openGraph: {
      title: `${category.title} | M-Machine`,
      description: category.description,
      url: absoluteUrl(categoryUrl(category)),
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { categorySlug } = await params;
  const category = getSeoCategory(categorySlug);
  if (!category) notFound();

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Parts", path: "/parts" },
    { name: category.title, path: categoryUrl(category) },
  ]);

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.title,
    description: category.description,
    url: absoluteUrl(categoryUrl(category)),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: category.products.length,
      itemListElement: category.products.slice(0, 50).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/products/${productSlug(productForCategory(category, product))}`),
      })),
    },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Can I order these parts online?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "M-Machine handles orders manually. Add items to the order form or contact the team with the part number, size or specification.",
        },
      },
      {
        "@type": "Question",
        name: "Are prices final?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Prices are shown from the current catalogue data where available. The team confirms availability, carriage and final invoice details before payment.",
        },
      },
    ],
  };

  const childCategories = category.kind === "mini-index"
    ? getAllSeoCategories().filter((entry) => entry.kind === "mini-section")
    : category.kind === "metals-index"
      ? getAllSeoCategories().filter((entry) => entry.kind === "metal-category")
      : [];

  const shownProducts = category.kind === "mini-index" || category.kind === "metals-index"
    ? category.products.slice(0, 120)
    : category.products;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(collection)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faq)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/parts" className="hover:text-racing">Parts</Link>
        <span className="mx-2">/</span>
        <span>{category.title}</span>
      </nav>

      <header className="mb-8 max-w-3xl">
        <h1 className="font-display text-4xl text-racing mb-3">{category.title}</h1>
        <p className="text-ink-muted leading-relaxed">{category.description}</p>
      </header>

      {childCategories.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-2xl text-racing mb-3">Browse related sections</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {childCategories.map((child) => (
              <Link key={child.slug} href={categoryUrl(child)} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
                <h3 className="font-semibold text-racing">{child.title}</h3>
                <p className="text-xs text-ink-muted mt-1">{child.products.length} items</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-2xl text-racing">Parts in this category</h2>
            <p className="text-sm text-ink-muted">
              Showing {shownProducts.length} of {category.products.length} catalogue items.
            </p>
          </div>
          <Link href="/contact" className="btn-secondary text-sm">Ask about this category</Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shownProducts.map((product) => (
            <ProductSummaryCard
              key={product.id}
              category={category}
              product={product}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-cream-dark border-l-4 border-gold p-6">
        <h2 className="font-display text-xl text-racing mb-2">Need help choosing?</h2>
        <p className="text-sm text-ink-muted mb-3">
          Send the part number, vehicle details, metal specification or dimensions and M-Machine will confirm the right item and carriage.
        </p>
        <Link href="/contact" className="text-sm font-semibold text-racing hover:text-gold">
          Request a quote
        </Link>
      </section>
    </div>
  );
}

function productForCategory(category: SeoCategory, product: Product | MetalProduct) {
  return category.kind === "mini-index" || category.kind === "mini-section"
    ? ({ kind: "mini" as const, product: product as Product })
    : ({ kind: "metal" as const, product: product as MetalProduct });
}

function ProductSummaryCard({
  category,
  product,
}: {
  category: SeoCategory;
  product: Product | MetalProduct;
}) {
  const seoProduct = productForCategory(category, product);
  const href = `/products/${productSlug(seoProduct)}`;

  if (seoProduct.kind === "mini") {
    const item = seoProduct.product;
    return (
      <article className="rounded-lg border border-racing/10 bg-white p-4">
        <h3 className="font-semibold text-racing leading-snug">
          <Link href={href} className="hover:text-gold">{item.name}</Link>
        </h3>
        <p className="mt-1 font-mono text-xs text-ink-muted">{item.code}</p>
        <p className="mt-2 text-xs text-ink-muted">
          {[item.fits, item.mark, item.bodyType].filter(Boolean).join(" / ") || "Classic Mini panel"}
        </p>
        <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-racing hover:text-gold">
          View part details
        </Link>
      </article>
    );
  }

  const item = seoProduct.product;
  return (
    <article className="rounded-lg border border-racing/10 bg-white p-4">
      <h3 className="font-semibold text-racing leading-snug">
        <Link href={href} className="hover:text-gold">
          {[item.form, item.metal, item.spec].filter(Boolean).join(" - ")}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-ink-muted">{item.size || "Size on enquiry"}</p>
      <p className="mt-2 text-xs text-ink-muted">{item.unit || "Unit on enquiry"}</p>
      <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-racing hover:text-gold">
        View metal details
      </Link>
    </article>
  );
}
