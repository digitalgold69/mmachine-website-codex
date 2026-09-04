"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { OrderButton } from "@/components/QuoteCart";
import { products, sections, getSection, type Product, type Section } from "@/lib/mini-data";
import { miniCatalogueUrl, miniCatalogueVersion } from "@/lib/catalogue-versions";
import { MANUAL_MINI_SECTION_CODE, manualMiniSection } from "@/lib/manual-mini-product-shared";

const Mini3DViewer = dynamic(() => import("@/components/Mini3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="mt-4 rounded-lg border border-racing/10 bg-white p-4 text-sm text-ink-muted">
      Loading panel selector...
    </div>
  ),
});

type MiniProductImage = {
  productId: string;
  url: string;
  uploadedAt: string;
};

type ProductPreviewImage = MiniProductImage & {
  alt: string;
  code: string;
};

const money = (value: number | null) =>
  value === null ? "POA" : `\u00a3${value.toFixed(2)}`;

export default function MiniCataloguePage() {
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [displayLimit, setDisplayLimit] = useState(50);
  const [catalogueProducts, setCatalogueProducts] = useState<Product[]>(products);
  const [productImages, setProductImages] = useState<Record<string, MiniProductImage>>({});
  const [previewImage, setPreviewImage] = useState<ProductPreviewImage | null>(null);
  const partsListRef = useRef<HTMLDivElement | null>(null);
  const sectionSummaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/products?catalogue=mini&limit=1200", { cache: "no-store" })
      .then(async (response): Promise<{ products?: Product[] } | null> =>
        response.ok ? (await response.json()) as { products?: Product[] } : null
      )
      .then((data: { products?: Product[] } | null) => {
        if (cancelled || !Array.isArray(data?.products)) return;
        setCatalogueProducts(data.products);
      })
      .catch(() => {
        if (!cancelled) setCatalogueProducts(products);
      });

    fetch("/api/mini-product-images", { cache: "no-store" })
      .then(async (response): Promise<{ images?: MiniProductImage[] } | null> =>
        response.ok ? (await response.json()) as { images?: MiniProductImage[] } : null
      )
      .then((data: { images?: MiniProductImage[] } | null) => {
        if (cancelled || !Array.isArray(data?.images)) return;
        setProductImages(Object.fromEntries(data.images.map((image) => [image.productId, image])));
      })
      .catch(() => {
        if (!cancelled) setProductImages({});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = catalogueProducts;
    if (section !== "all") list = list.filter((p) => p.section === section);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.fits.toLowerCase().includes(q)
      );
    }
    return list;
  }, [catalogueProducts, section, search]);

  const sectionCounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const counts: Record<string, number> = { all: 0 };

    for (const product of catalogueProducts) {
      if (query && ![product.code, product.name, product.fits].join(" ").toLowerCase().includes(query)) continue;

      counts.all += 1;
      counts[product.section] = (counts[product.section] || 0) + 1;
    }

    return counts;
  }, [catalogueProducts, search]);

  const shown = filtered.slice(0, displayLimit);
  const catalogueSections = useMemo<Section[]>(
    () =>
      catalogueProducts.some((product) => product.section === MANUAL_MINI_SECTION_CODE)
        ? [...sections, manualMiniSection]
        : sections,
    [catalogueProducts]
  );
  const currentSection = section === MANUAL_MINI_SECTION_CODE ? manualMiniSection : getSection(section);

  function chooseSection(nextSection: string) {
    setSection(nextSection);
    setDisplayLimit(50);
    window.setTimeout(() => {
      const target = nextSection === "all" ? partsListRef.current : sectionSummaryRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">
          &larr; Home
        </Link>
        <h1 className="font-display text-4xl text-racing mt-2 mb-2">
          Classic Mini panels catalogue
        </h1>
        <p className="text-ink-muted">
          {catalogueProducts.length} parts across {catalogueSections.length} sections, organised in the same down-the-list order as the printed catalogue.
        </p>
      </div>

      <Mini3DViewer selectedSection={section} onSelect={chooseSection} />

      <div className="mt-6 rounded-xl border border-racing/10 bg-white p-3 sm:p-4">
        <div className="min-w-0 space-y-3">
            <label htmlFor="mini-panel-search" className="sr-only">
              Search the Classic Mini panels catalogue
            </label>
            <input
              id="mini-panel-search"
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDisplayLimit(50); }}
              placeholder="Search parts by code or description"
              className="input w-full"
            />

            <div className="overflow-x-auto border-t border-racing/5 pt-3">
              <div className="flex w-max gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => chooseSection("all")}
                  className={`min-h-[58px] w-[112px] shrink-0 rounded-md border px-2 py-2 text-center transition-colors ${
                    section === "all"
                      ? "border-racing bg-racing text-cream"
                      : "border-racing/10 bg-cream-dark text-racing hover:border-gold"
                  }`}
                >
                  <span className="block font-mono text-lg font-bold leading-none">All</span>
                  <span className="mt-1 block truncate text-[12px] font-semibold leading-tight">All sections</span>
                  <span className={`block text-[11px] ${section === "all" ? "text-cream/75" : "text-ink-muted"}`}>
                    {sectionCounts.all || 0}
                  </span>
                </button>

                {catalogueSections.map((s) => {
                  const count = sectionCounts[s.code] || 0;
                  const active = section === s.code;
                  return (
              <button
                type="button"
                key={s.code}
                onClick={() => chooseSection(s.code)}
                className={`min-h-[58px] w-[112px] shrink-0 rounded-md border px-2 py-2 text-center transition-colors ${
                  active
                    ? "border-racing bg-racing text-cream"
                    : "border-racing/10 bg-cream-dark text-racing hover:border-gold"
                }`}
                title={s.subtitle}
              >
                <span className="block font-mono text-lg font-bold leading-none">{s.code}</span>
                <span className="mt-1 block truncate text-[12px] font-semibold leading-tight">{s.label}</span>
                <span className={`block text-[11px] ${active ? "text-cream/75" : "text-ink-muted"}`}>
                  {count}
                </span>
              </button>
                  );
                })}
              </div>
            </div>
        </div>
      </div>

      <div ref={partsListRef} className="scroll-mt-4" />
      {currentSection && (
        <div
          ref={sectionSummaryRef}
          className="mt-6 scroll-mt-28 rounded-lg border-l-4 border-gold bg-cream-dark p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:gap-y-2">
            <div className="flex items-start gap-4">
              <div className="font-mono text-2xl font-bold leading-none text-racing">{currentSection.code}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5 text-[11px] font-semibold leading-tight sm:hidden">
                <a
                  href={`/api/catalogue/mini-sections/${encodeURIComponent(currentSection.code)}/pdf?v=${miniCatalogueVersion}&view=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-racing underline-offset-2 hover:text-gold hover:underline"
                >
                  Download {currentSection.code} Section PDF
                </a>
                <a
                  href={miniCatalogueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-racing underline-offset-2 hover:text-gold hover:underline"
                >
                  Download Full PDF Catalogue
                </a>
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg text-racing leading-none">{currentSection.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-ink-muted">{currentSection.subtitle}</span>
                <a
                  href={`/api/catalogue/mini-sections/${encodeURIComponent(currentSection.code)}/pdf?v=${miniCatalogueVersion}&view=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden font-semibold text-racing underline-offset-2 hover:text-gold hover:underline sm:inline"
                >
                  Download {currentSection.code} Section PDF
                </a>
                <a
                  href={miniCatalogueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden font-semibold text-racing underline-offset-2 hover:text-gold hover:underline sm:inline"
                >
                  Download Full PDF Catalogue
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-ink-muted">
          Showing <strong className="text-racing">{shown.length}</strong> of{" "}
          <strong className="text-racing">{filtered.length}</strong> parts
          {filtered.length !== catalogueProducts.length && ` (filtered from ${catalogueProducts.length})`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-racing/10 overflow-hidden mt-3">
        <div className="hidden md:block">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[132px]" />
              <col className="w-[58px]" />
              <col />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[84px]" />
            </colgroup>
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-1 py-3 text-center">
                  <span className="inline-block translate-x-5">Photo</span>
                </th>
                <th className="py-3 pl-12 pr-3 text-left xl:pl-20">Description</th>
                <th className="text-right px-4 py-3">&pound; ex VAT</th>
                <th className="text-right px-4 py-3">&pound; Inc VAT</th>
                <th className="text-center px-3 py-3">Order</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const image = productImages[p.id];
                return (
                  <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-ink-muted whitespace-nowrap align-middle">{p.code}</td>
                    <td className="px-1 py-2 text-center align-middle">
                      {image ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ ...image, alt: p.name, code: p.code })}
                          className="mx-auto block h-11 w-11 translate-x-5 overflow-hidden rounded-md border border-racing/10 bg-cream-dark"
                          aria-label={`View photo for ${p.name}`}
                        >
                          <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      ) : (
                        <NoImageIcon />
                      )}
                    </td>
                    <td className="py-2 pl-12 pr-3 align-middle xl:pl-20">
                      <div className="font-medium text-racing leading-snug">{p.name}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-racing whitespace-nowrap align-middle">
                      {money(p.priceExVat)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-racing whitespace-nowrap align-middle">
                      {money(p.priceIncVat)}
                    </td>
                    <td className="px-3 py-2 text-center align-middle">
                      <OrderButton
                        item={{
                          key: `mini-${p.id}`,
                          catalogue: "mini",
                          productId: p.id,
                          code: p.code,
                          description: p.name,
                          unit: "each",
                          unitPriceExVat: p.priceExVat,
                          unitPriceIncVat: p.priceIncVat,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-ink-muted">
                    No parts match. Try a different section, clear filters, or call us on 01325 381300.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-racing/5">
          {shown.map((p) => {
            const image = productImages[p.id];
            return (
              <div key={p.id} className="p-4 hover:bg-cream-dark/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex min-w-0 gap-3">
                    {image && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ ...image, alt: p.name, code: p.code })}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-racing/10 bg-cream-dark"
                        aria-label={`View photo for ${p.name}`}
                      >
                        <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-racing leading-snug">{p.name}</div>
                    </div>
                  </div>
                  <div className="font-semibold text-racing whitespace-nowrap text-right">
                    {money(p.priceExVat)}
                    <div className="text-xs font-normal text-ink-muted">ex VAT</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
                  <span className="font-mono">{p.code}</span>
                  <span className="text-right">
                    Inc VAT: <strong className="text-racing">{money(p.priceIncVat)}</strong>
                  </span>
                </div>
                <div className="mt-3">
                  <OrderButton
                    item={{
                      key: `mini-${p.id}`,
                      catalogue: "mini",
                      productId: p.id,
                      code: p.code,
                      description: p.name,
                      unit: "each",
                      unitPriceExVat: p.priceExVat,
                      unitPriceIncVat: p.priceIncVat,
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="text-center py-12 text-ink-muted px-4">
              No parts match. Try a different section, clear filters, or call us on 01325 381300.
            </div>
          )}
        </div>

        {shown.length < filtered.length && (
          <div className="bg-cream-dark border-t border-racing/10 p-4 text-center">
            <button onClick={() => setDisplayLimit(displayLimit + 50)} className="btn-secondary text-sm">
              Show more ({filtered.length - shown.length} remaining)
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
        <Link href="/contact" className="btn-primary">
          Enquire about parts
        </Link>
        <a
          href={miniCatalogueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          Download full PDF catalogue
        </a>
      </div>
      <p className="text-xs text-ink-muted text-center mt-3">
        Prices shown are current as of catalogue date. Phone 01325 381300 to place an order.
      </p>

      {previewImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-racing/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.alt}
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <div className="absolute left-3 top-3 z-10 flex max-w-[min(72vw,34rem)] flex-col items-start gap-1">
              <span className="inline-block max-w-full truncate rounded-full bg-racing px-3 py-1 text-xs font-semibold text-cream shadow">
                {previewImage.alt}
              </span>
              <span className="inline-block max-w-full truncate rounded-full bg-cream px-2.5 py-0.5 font-mono text-[11px] font-semibold text-racing shadow">
                {previewImage.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-racing shadow hover:bg-cream"
            >
              Close
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.alt}
              className="max-h-[86vh] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NoImageIcon() {
  return (
    <div
      className="mx-auto flex h-11 w-11 translate-x-5 flex-col items-center justify-center rounded-md border border-dashed border-racing/20 bg-cream-dark/70 text-racing/60"
      title="No image yet"
      aria-label="No image yet"
    >
      <span className="relative block h-4 w-5 rounded-[3px] border border-current before:absolute before:-top-1 before:left-1 before:h-1 before:w-2 before:rounded-sm before:border before:border-current before:content-[''] after:absolute after:left-1/2 after:top-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-current after:content-['']" />
      <span className="mt-1 text-[8px] font-bold uppercase leading-none">No image</span>
    </div>
  );
}
