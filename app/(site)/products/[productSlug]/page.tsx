import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrderButton } from "@/components/QuoteCart";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  categoryUrl,
  getSeoProduct,
  jsonLdScript,
  productCategory,
  productMetaDescription,
  productName,
  productSku,
  productSlug as makeProductSlug,
  productUrl,
  relatedProducts,
  type SeoProduct,
} from "@/lib/seo";

type PageProps = {
  params: Promise<{ productSlug: string }>;
};

export const dynamicParams = true;
export const revalidate = 86400;

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `\u00a3${value.toFixed(2)}` : "POA";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productSlug } = await params;
  const item = getSeoProduct(productSlug);
  if (!item) return {};

  const name = productName(item);
  const description = productMetaDescription(item);

  return {
    title: `${name}${productSku(item) ? ` | ${productSku(item)}` : ""}`,
    description,
    alternates: { canonical: absoluteUrl(productUrl(item)) },
    openGraph: {
      title: `${name} | M-Machine`,
      description,
      url: absoluteUrl(productUrl(item)),
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { productSlug } = await params;
  const item = getSeoProduct(productSlug);
  if (!item) notFound();

  const name = productName(item);
  const sku = productSku(item);
  const category = productCategory(item);
  const categoryPath = category ? categoryUrl(category) : "/parts";
  const categoryName = category?.title || "Parts";
  const related = relatedProducts(item, 6);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Parts", path: "/parts" },
    { name: categoryName, path: categoryPath },
    { name, path: productUrl(item) },
  ]);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: sku || undefined,
    category: categoryName,
    description: productMetaDescription(item),
    url: absoluteUrl(productUrl(item)),
    isAccessoryOrSparePartFor: item.kind === "mini"
      ? {
          "@type": "Product",
          name: "Classic Mini",
        }
      : undefined,
  };

  const contactUrl = `/contact?product=${encodeURIComponent(name)}${sku ? `&sku=${encodeURIComponent(sku)}` : ""}&category=${encodeURIComponent(categoryName)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(productSchema)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/parts" className="hover:text-racing">Parts</Link>
        <span className="mx-2">/</span>
        <Link href={categoryPath} className="hover:text-racing">{categoryName}</Link>
        <span className="mx-2">/</span>
        <span>{name}</span>
      </nav>

      <article className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <p className="text-xs font-semibold tracking-wider text-gold mb-2">{item.kind === "mini" ? "CLASSIC MINI PART" : "ENGINEERING METAL"}</p>
          <h1 className="font-display text-4xl text-racing mb-3">{name}</h1>
          <p className="text-ink-muted leading-relaxed max-w-3xl">
            {productMetaDescription(item)}
          </p>

          <dl className="mt-8 grid sm:grid-cols-2 gap-4">
            {sku && (
              <div className="rounded-lg bg-white border border-racing/10 p-4">
                <dt className="text-xs uppercase tracking-wider text-ink-muted">Part number / SKU</dt>
                <dd className="mt-1 font-mono text-racing">{sku}</dd>
              </div>
            )}
            <div className="rounded-lg bg-white border border-racing/10 p-4">
              <dt className="text-xs uppercase tracking-wider text-ink-muted">Category</dt>
              <dd className="mt-1">
                <Link href={categoryPath} className="font-semibold text-racing hover:text-gold">
                  {categoryName}
                </Link>
              </dd>
            </div>
            {item.kind === "mini" ? (
              <>
                <Detail label="Fits" value={item.product.fits || "Classic Mini"} />
                <Detail label="Mark / model" value={[item.product.mark, item.product.bodyType].filter(Boolean).join(" / ") || "See catalogue"} />
                <Detail label="Machine type" value={<Link href="/machines/classic-mini" className="text-racing hover:text-gold">Classic Mini</Link>} />
                <Detail label="Availability" value="Enquire for availability" />
              </>
            ) : (
              <>
                <Detail label="Shape" value={item.product.form || "On enquiry"} />
                <Detail label="Metal" value={item.product.metal || "On enquiry"} />
                <Detail label="Spec." value={item.product.spec || "On enquiry"} />
                <Detail label="Size" value={item.product.size || "On enquiry"} />
                <Detail label="Unit" value={item.product.unit || "On enquiry"} />
                <Detail label="Availability" value="Enquire for availability" />
              </>
            )}
          </dl>
        </div>

        <aside className="rounded-xl border border-racing/10 bg-white p-5 h-fit">
          <h2 className="font-display text-xl text-racing mb-3">Request a quote</h2>
          <div className="space-y-2 text-sm mb-5">
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Price ex VAT</span>
              <strong className="text-racing">{money(item.product.priceExVat)}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Price inc VAT</span>
              <strong className="text-racing">{money(item.product.priceIncVat)}</strong>
            </div>
          </div>
          <OrderButton item={quoteItem(item)} className="w-full" />
          <Link href={contactUrl} className="mt-3 inline-flex w-full justify-center rounded-lg border border-racing px-4 py-3 text-sm font-semibold text-racing hover:bg-racing hover:text-cream">
            Ask about this part
          </Link>
          <p className="mt-3 text-xs text-ink-muted">
            The final invoice, carriage and payment details are confirmed manually by M-Machine.
          </p>
        </aside>
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-racing mb-4">Related parts</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((relatedItem) => (
              <Link key={makeProductSlug(relatedItem)} href={productUrl(relatedItem)} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
                <h3 className="font-semibold text-racing leading-snug">{productName(relatedItem)}</h3>
                <p className="mt-1 text-xs text-ink-muted">{productSku(relatedItem) || productCategory(relatedItem)?.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white border border-racing/10 p-4">
      <dt className="text-xs uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1 text-racing">{value}</dd>
    </div>
  );
}

function quoteItem(item: SeoProduct) {
  if (item.kind === "mini") {
    const p = item.product;
    return {
      key: `mini-${p.id}`,
      catalogue: "mini" as const,
      productId: p.id,
      code: p.code,
      description: p.name,
      unit: "each",
      unitPriceExVat: p.priceExVat,
      unitPriceIncVat: p.priceIncVat,
    };
  }

  const p = item.product;
  return {
    key: `metals-${p.id}`,
    catalogue: "metals" as const,
    productId: p.id,
    code: p.code,
    description: [p.form, p.metal, p.spec, p.size].filter(Boolean).join(" - "),
    shape: p.form,
    metal: p.metal,
    spec: p.spec,
    size: p.size,
    unit: p.unit,
    unitPriceExVat: p.priceExVat,
    unitPriceIncVat: p.priceIncVat,
  };
}
