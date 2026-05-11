"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Mini3DViewer from "@/components/Mini3DViewer";
import { products, sections, getSection } from "@/lib/mini-data";

const BODY_TYPES = ["All", "Saloon", "Traveller", "Van", "Pick-Up", "Cooper", "Elf/Hornet", "Clubman", "Clubman Estate"];
const MARKS = ["All marks", "Mark I", "Mark II", "Mark III", "Mark IV", "Mark V", "Hydrolastic Mk I"];

export default function MiniCataloguePage() {
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [bodyFilter, setBodyFilter] = useState("All");
  const [markFilter, setMarkFilter] = useState("All marks");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVat, setShowVat] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">← Home</Link>
        <h1 className="font-display text-4xl text-racing mt-2 mb-2">
          Classic Mini panels catalogue
        </h1>
        <p className="text-ink-muted">
          {products.length} parts across {sections.length} sections — organised exactly like the PDF catalogue.
          Click a panel on the Mini, or pick a section below.
        </p>
      </div>

      <Mini3DViewer selectedSection={section} onSelect={(s) => { setSection(s); setDisplayLimit(50); }} />

      {/* FILTER BAR — compact, single strip */}
      <div className="mt-6 bg-white rounded-xl border border-racing/10 p-3 sm:p-4 space-y-3">
        {/* Row 1: search + toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setDisplayLimit(50); }}
              placeholder="Search parts — code, name, or fits"
              className="input w-full pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-muted whitespace-nowrap px-2">
            <input type="checkbox" checked={showVat} onChange={(e) => setShowVat(e.target.checked)} />
            inc. VAT
          </label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-racing hover:text-gold underline whitespace-nowrap px-2"
          >
            {showAdvanced ? "− Hide" : "+ More"} filters
          </button>
        </div>

        {/* Row 2: advanced filters (collapsible) */}
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

        {/* Row 3: section chips — all on one strip, grouped by subtle inline labels */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-racing/5">
          <button
            onClick={() => { setSection("all"); setDisplayLimit(50); }}
            className={`chip transition-colors ${section === "all" ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
          >
            All ({products.length})
          </button>

          <span className="text-[10px] tracking-widest text-ink-muted/70 font-semibold ml-2 mr-1">EXT</span>
          {sections.filter((s) => s.mode === "exterior").map((s) => {
            const count = products.filter((p) => p.section === s.code).length;
            return (
              <button
                key={s.code}
                onClick={() => { setSection(s.code); setDisplayLimit(50); }}
                className={`chip transition-colors ${section === s.code ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
                title={s.subtitle}
              >
                <span className="font-mono opacity-60 mr-1">{s.code}</span>{s.label} ({count})
              </button>
            );
          })}

          <span className="text-[10px] tracking-widest text-ink-muted/70 font-semibold ml-2 mr-1">INT</span>
          {sections.filter((s) => s.mode === "interior").map((s) => {
            const count = products.filter((p) => p.section === s.code).length;
            return (
              <button
                key={s.code}
                onClick={() => { setSection(s.code); setDisplayLimit(50); }}
                className={`chip transition-colors ${section === s.code ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
                title={s.subtitle}
              >
                <span className="font-mono opacity-60 mr-1">{s.code}</span>{s.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected section banner */}
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

      {/* Results count */}
      <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-ink-muted">
          Showing <strong className="text-racing">{shown.length}</strong> of{" "}
          <strong className="text-racing">{filtered.length}</strong> parts
          {filtered.length !== products.length && ` (filtered from ${products.length})`}
        </p>
      </div>

      {/* Results — desktop table, mobile cards. Both versions share the same data
          and filters; only the visual presentation changes at the md breakpoint. */}
      <div className="bg-white rounded-xl border border-racing/10 overflow-hidden mt-3">

        {/* DESKTOP TABLE — md and up. Explicit column widths via colgroup so
            the Part column doesn't push everything else into the right margin. */}
        <div className="hidden md:block">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[14%]" />
              <col />
              <col className="w-[14%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Part</th>
                <th className="text-left px-4 py-3">Fits</th>
                <th className="text-left px-4 py-3">Section</th>
                <th className="text-left px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap align-top">{p.code}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-racing leading-snug">{p.name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted align-top truncate" title={p.fits}>{p.fits}</td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-mono text-xs bg-cream-dark text-racing px-2 py-0.5 rounded">
                      {p.section}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <span className={`stock-badge stock-${p.stock}`}>
                      {p.stock === "in" ? "In stock" : p.stock === "low" ? "Low" : "Out"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-racing whitespace-nowrap align-top">
                    {p.priceExVat !== null ? (
                      `£${(showVat ? p.priceIncVat : p.priceExVat)?.toFixed(2) ?? p.priceExVat.toFixed(2)}`
                    ) : (
                      <span className="text-xs text-ink-muted italic">POA</span>
                    )}
                  </td>
                </tr>
              ))}
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

        {/* MOBILE CARDS — under md. No horizontal scroll. */}
        <div className="md:hidden divide-y divide-racing/5">
          {shown.map((p) => (
            <div key={p.id} className="p-4 hover:bg-cream-dark/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="font-medium text-racing leading-snug">{p.name}</div>
                <div className="font-semibold text-racing whitespace-nowrap text-right">
                  {p.priceExVat !== null ? (
                    `£${(showVat ? p.priceIncVat : p.priceExVat)?.toFixed(2) ?? p.priceExVat.toFixed(2)}`
                  ) : (
                    <span className="text-xs text-ink-muted italic">POA</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-mono text-ink-muted">{p.code}</span>
                <span className="text-ink-muted">{p.fits}</span>
                <span className="font-mono bg-cream-dark text-racing px-1.5 py-0.5 rounded">
                  {p.section}
                </span>
                <span className={`stock-badge stock-${p.stock} ml-auto`}>
                  {p.stock === "in" ? "In stock" : p.stock === "low" ? "Low" : "Out"}
                </span>
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
          Enquire about parts →
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
        All prices exclude VAT unless toggled. Prices shown are current as of catalogue date. Phone 01325 381300 to place an order.
      </p>
    </div>
  );
}
