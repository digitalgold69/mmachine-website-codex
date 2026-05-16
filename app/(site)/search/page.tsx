import Link from "next/link";
import type { Metadata } from "next";
import {
  getAllSeoProducts,
  productMetaDescription,
  productName,
  productSku,
  productUrl,
} from "@/lib/seo";

type PageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Search M-Machine parts",
  description: "Search M-Machine Classic Mini parts and engineering metals.",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default async function SearchPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery || "").trim().toLowerCase();
  const results = query
    ? getAllSeoProducts()
        .filter((item) =>
          [productName(item), productSku(item), productMetaDescription(item)]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
        .slice(0, 60)
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display text-4xl text-racing mb-3">Search parts</h1>
      <form action="/search" className="mb-8">
        <label className="label" htmlFor="site-search">Search by part number, description, metal or specification</label>
        <div className="flex gap-2">
          <input id="site-search" name="q" defaultValue={rawQuery || ""} className="input" />
          <button className="btn-primary" type="submit">Search</button>
        </div>
      </form>

      {query && (
        <p className="mb-4 text-sm text-ink-muted">
          Showing {results.length} results for <strong className="text-racing">{rawQuery}</strong>.
        </p>
      )}

      <div className="grid gap-3">
        {results.map((item) => (
          <Link key={productUrl(item)} href={productUrl(item)} className="rounded-lg border border-racing/10 bg-white p-4 hover:border-gold">
            <h2 className="font-semibold text-racing">{productName(item)}</h2>
            <p className="mt-1 text-xs text-ink-muted">{productSku(item) || productMetaDescription(item)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
