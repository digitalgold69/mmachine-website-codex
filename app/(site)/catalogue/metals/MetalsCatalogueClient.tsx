"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { OrderButton } from "@/components/QuoteCart";
import type { MetalProduct } from "@/lib/metals-data";
import { metalsCatalogueUrl } from "@/lib/catalogue-versions";

const PAGE_SIZE = 120;

type Category = { key: string; label: string; count: number };
type ProductsResponse = { products?: MetalProduct[]; count?: number; error?: string };

const formatPrice = (value: number | null) =>
  value === null ? "POA" : `\u00a3${value.toFixed(2)}`;

export default function MetalsCatalogueClient({
  initialProducts,
  initialCount,
  total,
  categories,
}: {
  initialProducts: MetalProduct[];
  initialCount: number;
  total: number;
  categories: Category[];
}) {
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [matchCount, setMatchCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const firstRun = useRef(true);
  const activeQuery = `${cat}\n${search.trim()}`;
  const activeQueryRef = useRef(activeQuery);
  activeQueryRef.current = activeQuery;

  const categoryLabel = categories.find((category) => category.key === cat)?.label ?? cat;

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          catalogue: "metals",
          category: cat,
          q: search.trim(),
          offset: "0",
          limit: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal });
        const data = (await response.json()) as ProductsResponse;
        if (!response.ok) throw new Error(data.error || "The catalogue could not be loaded.");
        setProducts(data.products || []);
        setMatchCount(Number(data.count || 0));
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setError("The catalogue could not be loaded. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cat, search]);

  async function loadMore() {
    const requestQuery = activeQuery;
    setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({
        catalogue: "metals",
        category: cat,
        q: search.trim(),
        offset: String(products.length),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/products?${params}`);
      const data = (await response.json()) as ProductsResponse;
      if (!response.ok) throw new Error(data.error || "More catalogue lines could not be loaded.");
      if (activeQueryRef.current !== requestQuery) return;
      setProducts((current) => [...current, ...(data.products || [])]);
      setMatchCount(Number(data.count ?? matchCount));
    } catch {
      setError("More catalogue lines could not be loaded. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  function selectCategory(key: string) {
    setCat(key);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">&larr; Home</Link>
        <h1 className="mt-2 font-display text-4xl text-racing">Metals catalogue</h1>
        <p className="mt-2 max-w-3xl text-ink-muted">
          Browse the metals catalogue in the same column format as the printed customer catalogue.
          Prices are shown ex VAT and inc VAT.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg border border-racing/10 bg-racing">
          <Image
            src="/catalogue/m-machine-metals-cutting.gif"
            alt="Engineering metal being cut in the M-Machine workshop"
            width={1024}
            height={409}
            priority
            unoptimized
            className="aspect-[1024/409] w-full object-cover"
          />
        </div>
      </header>

      <div className="mb-6">
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter by metal category">
          <button
            type="button"
            onClick={() => selectCategory("all")}
            aria-pressed={cat === "all"}
            className={`chip transition-colors ${cat === "all" ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
          >
            All metals ({total})
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.key}
              onClick={() => selectCategory(category.key)}
              aria-pressed={cat === category.key}
              className={`chip transition-colors ${cat === category.key ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
            >
              {category.label} ({category.count})
            </button>
          ))}
        </div>
        <label htmlFor="metals-search" className="sr-only">Search the metals catalogue</label>
        <input
          id="metals-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by shape, metal, spec, size, or unit"
          className="input max-w-2xl"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {loading ? (
            "Updating results..."
          ) : (
            <>
              Showing <strong className="text-racing">{products.length}</strong> of{" "}
              <strong className="text-racing">{matchCount}</strong> matching lines
              {matchCount !== total && ` (filtered from ${total})`}
              {cat !== "all" && ` in ${categoryLabel}`}
            </>
          )}
        </p>
        <a href={metalsCatalogueUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
          Download full PDF catalogue
        </a>
      </div>

      {error && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className={`overflow-hidden rounded-xl border border-racing/10 bg-white transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1120px] table-fixed">
            <colgroup>
              <col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[10%]" />
              <col /><col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[10%]" />
              <col className="w-[84px]" />
            </colgroup>
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Shape</th><th className="px-4 py-3 text-left">Metal</th>
                <th className="px-4 py-3 text-left">Spec.</th><th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-right">&pound; ex VAT</th><th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-right">&pound; Inc VAT</th><th className="px-3 py-3 text-center">Order</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-racing/5 transition-colors hover:bg-cream-dark/50">
                  <td className="px-4 py-2 align-middle text-sm font-medium text-racing">{product.form || "-"}</td>
                  <td className="px-4 py-2 align-middle text-sm text-ink">{product.metal || "-"}</td>
                  <td className="px-4 py-2 align-middle text-sm text-ink-muted">{product.spec || "-"}</td>
                  <td className="px-4 py-2 align-middle text-sm text-ink">{product.size || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right align-middle text-sm font-semibold text-racing">{formatPrice(product.priceExVat)}</td>
                  <td className="whitespace-nowrap px-4 py-2 align-middle text-sm text-ink-muted">{product.unit || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right align-middle text-sm font-semibold text-racing">{formatPrice(product.priceIncVat)}</td>
                  <td className="px-3 py-2 text-center align-middle"><OrderButton item={quoteItem(product)} /></td>
                </tr>
              ))}
              {!loading && products.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-ink-muted">No catalogue lines match that search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-racing/5 lg:hidden">
          {products.map((product) => (
            <article key={product.id} className="p-4 transition-colors hover:bg-cream-dark/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium leading-snug text-racing">{product.form} {product.metal}</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">{[product.spec, product.size].filter(Boolean).join(" - ")}</p>
                </div>
                <div className="whitespace-nowrap text-right">
                  <div className="font-semibold text-racing">{formatPrice(product.priceExVat)}</div>
                  <div className="text-xs text-ink-muted">ex VAT</div>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="uppercase tracking-wider text-ink-muted">Shape</dt><dd className="text-ink">{product.form || "-"}</dd></div>
                <div><dt className="uppercase tracking-wider text-ink-muted">Unit</dt><dd className="text-ink">{product.unit || "-"}</dd></div>
                <div><dt className="uppercase tracking-wider text-ink-muted">&pound; Inc VAT</dt><dd className="font-semibold text-racing">{formatPrice(product.priceIncVat)}</dd></div>
                <div><dt className="uppercase tracking-wider text-ink-muted">Category</dt><dd className="text-ink">{categories.find((category) => category.key === product.category)?.label || product.metal}</dd></div>
              </dl>
              <div className="mt-3"><OrderButton item={quoteItem(product)} className="w-full" /></div>
            </article>
          ))}
          {!loading && products.length === 0 && <div className="px-4 py-12 text-center text-ink-muted">No catalogue lines match that search.</div>}
        </div>

        {products.length < matchCount && (
          <div className="border-t border-racing/10 bg-cream-dark p-4 text-center">
            <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60">
              {loadingMore ? "Loading..." : `Show more (${matchCount - products.length} remaining)`}
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border-l-4 border-gold bg-cream-dark p-6">
        <h2 className="font-display text-lg text-racing">Need technical advice?</h2>
        <p className="mb-3 mt-2 text-sm text-ink-muted">Call 01325 381302 if you need help choosing a metal, size, or cut length.</p>
        <Link href="/contact" className="text-sm font-medium text-racing hover:text-gold">Get in touch &rarr;</Link>
      </div>
    </div>
  );
}

function quoteItem(product: MetalProduct) {
  return {
    key: `metals-${product.id}`,
    catalogue: "metals" as const,
    productId: product.id,
    code: product.code,
    description: [product.form, product.metal, product.spec, product.size].filter(Boolean).join(" - "),
    shape: product.form,
    metal: product.metal,
    spec: product.spec,
    size: product.size,
    unit: product.unit,
    unitPriceExVat: product.priceExVat,
    unitPriceIncVat: product.priceIncVat,
  };
}
