"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { OrderButton } from "@/components/QuoteCart";
import { products, sections, getSection } from "@/lib/mini-data";

const Mini3DViewer = dynamic(() => import("@/components/Mini3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="mt-4 rounded-lg border border-racing/10 bg-white p-4 text-sm text-ink-muted">
      Loading panel selector...
    </div>
  ),
});

const BODY_TYPES = ["All", "Saloon", "Traveller", "Van", "Pick-Up", "Cooper", "Elf/Hornet", "Clubman", "Clubman Estate"];
const MARKS = ["All marks", "Mark I", "Mark II", "Mark III", "Mark IV", "Mark V", "Hydrolastic Mk I"];

const money = (value: number | null) =>
  value === null ? "POA" : `\u00a3${value.toFixed(2)}`;

export default function MiniCataloguePage() {
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [bodyFilter, setBodyFilter] = useState("All");
  const [markFilter, setMarkFilter] = useState("All marks");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [showPanelSelector, setShowPanelSelector] = useState(false);
  const partsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setShowPanelSelector(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (section !== "all") list = list.filter((p) => p.section === section);
    if (bodyFilter !== "All") list = list.filter((p) => p.bodyType === bodyFilter);
    if (markFilter !== "All marks") list = list.filter((p) => p.mark === markFilter);
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
  }, [section, search, bodyFilter, markFilter]);

  const shown = filtered.slice(0, displayLimit);
  const currentSection = getSection(section);

  function chooseSection(nextSection: string) {
    setSection(nextSection);
    setDisplayLimit(50);
    window.setTimeout(() => {
      partsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          {products.length} parts across {sections.length} sections, organised in the same down-the-list order as the printed catalogue.
        </p>
      </div>

      {showPanelSelector && (
        <Mini3DViewer selectedSection={section} onSelect={chooseSection} />
      )}

      <div className="mt-6 bg-white rounded-xl border border-racing/10 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDisplayLimit(50); }}
              placeholder="Search parts by code or description"
              className="input w-full"
            />
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-racing hover:text-gold underline whitespace-nowrap px-2"
          >
            {showAdvanced ? "- Hide" : "+ More"} filters
          </button>
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap items-end gap-3 pt-1 pb-2 border-t border-racing/5">
            <div className="min-w-[140px]">
              <label className="label">Body type</label>
              <select className="input" value={bodyFilter} onChange={(e) => setBodyFilter(e.target.value)}>
                {BODY_TYPES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="label">Mark / year</label>
              <select className="input" value={markFilter} onChange={(e) => setMarkFilter(e.target.value)}>
                {MARKS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            {(bodyFilter !== "All" || markFilter !== "All marks") && (
              <button
                onClick={() => { setBodyFilter("All"); setMarkFilter("All marks"); }}
                className="text-xs text-racing hover:text-gold underline pb-3"
              >
                Reset
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto pt-2 border-t border-racing/5">
          <div className="flex w-max gap-2 pb-1">
          <button
            onClick={() => chooseSection("all")}
            className={`min-h-[58px] w-[112px] shrink-0 rounded-md border px-2 py-2 text-center transition-colors ${
              section === "all"
                ? "border-racing bg-racing text-cream"
                : "border-racing/10 bg-cream-dark text-racing hover:border-gold"
            }`}
          >
            <span className="block font-mono text-lg font-bold leading-none">All</span>
            <span className="mt-1 block truncate text-[11px] font-semibold leading-tight">All sections</span>
            <span className={`block text-[10px] ${section === "all" ? "text-cream/75" : "text-ink-muted"}`}>
              {products.length}
            </span>
          </button>

          {sections.map((s) => {
            const count = products.filter((p) => p.section === s.code).length;
            const active = section === s.code;
            return (
              <button
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
                <span className="mt-1 block truncate text-[11px] font-semibold leading-tight">{s.label}</span>
                <span className={`block text-[10px] ${active ? "text-cream/75" : "text-ink-muted"}`}>
                  {count}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <div ref={partsListRef} className="scroll-mt-4" />
      {currentSection && (
        <div className="bg-cream-dark rounded-lg p-4 mt-6 border-l-4 border-gold">
          <div className="flex items-center gap-3 mb-1">
            <div className="font-mono text-2xl font-bold text-racing">{currentSection.code}</div>
            <div>
              <div className="font-display text-lg text-racing leading-none">{currentSection.label}</div>
              <div className="text-xs text-ink-muted mt-0.5">{currentSection.subtitle}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-ink-muted">
          Showing <strong className="text-racing">{shown.length}</strong> of{" "}
          <strong className="text-racing">{filtered.length}</strong> parts
          {filtered.length !== products.length && ` (filtered from ${products.length})`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-racing/10 overflow-hidden mt-3">
        <div className="hidden md:block">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[84px]" />
            </colgroup>
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">&pound; ex VAT</th>
                <th className="text-right px-4 py-3">&pound; Inc VAT</th>
                <th className="text-center px-3 py-3">Order</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-ink-muted whitespace-nowrap align-middle">{p.code}</td>
                  <td className="px-4 py-2 align-middle">
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
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-ink-muted">
                    No parts match. Try a different section, clear filters, or call us on 01325 381300.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-racing/5">
          {shown.map((p) => (
            <div key={p.id} className="p-4 hover:bg-cream-dark/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="font-medium text-racing leading-snug">{p.name}</div>
                  <div className="font-mono text-xs text-ink-muted mt-1">{p.code}</div>
                </div>
                <div className="font-semibold text-racing whitespace-nowrap text-right">
                  {money(p.priceExVat)}
                  <div className="text-xs font-normal text-ink-muted">ex VAT</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-ink-muted">
                Inc VAT: <strong className="text-racing">{money(p.priceIncVat)}</strong>
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
          ))}
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
          href="/catalogue/mini-catalogue.pdf"
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
    </div>
  );
}
