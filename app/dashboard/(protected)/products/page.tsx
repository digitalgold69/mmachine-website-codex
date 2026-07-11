"use client";

import { useMemo, useState } from "react";
import { products, sections } from "@/lib/mini-data";
import { metalCategories, metals } from "@/lib/metals-data";

type Catalogue = "mini" | "metals";

export default function DashboardProductsPage() {
  const [catalogue, setCatalogue] = useState<Catalogue>("mini");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(40);

  const miniRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) =>
      (category === "all" || product.section === category) &&
      (!query || [product.code, product.name, product.fits].join(" ").toLowerCase().includes(query))
    );
  }, [category, search]);

  const metalRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return metals.filter((product) =>
      (category === "all" || product.category === category) &&
      (!query || [product.code, product.form, product.metal, product.spec, product.size, product.unit]
        .join(" ")
        .toLowerCase()
        .includes(query))
    );
  }, [category, search]);

  const rows = catalogue === "mini" ? miniRows : metalRows;
  const total = catalogue === "mini" ? products.length : metals.length;

  function switchCatalogue(next: Catalogue) {
    setCatalogue(next);
    setSearch("");
    setCategory("all");
    setLimit(40);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing">Catalogue lookup</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Check the product details and prices currently shown on the website.
        </p>
      </div>

      <div className="mb-5 rounded-xl border-l-4 border-gold bg-cream-dark p-4 text-sm leading-6 text-racing">
        To change a price or product, edit the usual master spreadsheet on the M-Machine computer and run the
        M-Machine sync. This page is for checking the result; it does not change the master files.
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-racing/10 bg-white p-1">
        <button type="button" onClick={() => switchCatalogue("mini")} aria-pressed={catalogue === "mini"} className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "mini" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}>
          Mini panels ({products.length.toLocaleString("en-GB")})
        </button>
        <button type="button" onClick={() => switchCatalogue("metals")} aria-pressed={catalogue === "metals"} className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "metals" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}>
          Metals ({metals.length.toLocaleString("en-GB")})
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-racing/10 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <div>
            <label htmlFor="catalogue-search" className="label">Search catalogue</label>
            <input id="catalogue-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(40); }} placeholder={catalogue === "mini" ? "Part number or description" : "Shape, metal, spec or size"} className="input" />
          </div>
          <div>
            <label htmlFor="catalogue-category" className="label">Category</label>
            <select id="catalogue-category" value={category} onChange={(event) => { setCategory(event.target.value); setLimit(40); }} className="input">
              <option value="all">{catalogue === "mini" ? "All Mini sections" : "All metal categories"}</option>
              {catalogue === "mini"
                ? sections.map((section) => <option key={section.code} value={section.code}>{section.code} - {section.label}</option>)
                : metalCategories.map((metal) => <option key={metal.key} value={metal.key}>{metal.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-racing/10 bg-white">
        <div className="border-b border-racing/10 bg-cream-dark px-4 py-3 text-sm text-ink-muted">
          Showing {Math.min(limit, rows.length).toLocaleString("en-GB")} of {rows.length.toLocaleString("en-GB")} matching lines ({total.toLocaleString("en-GB")} total)
        </div>
        <div className="overflow-x-auto">
          {catalogue === "mini" ? (
            <table className="w-full min-w-[760px]">
              <thead className="text-xs uppercase tracking-wider text-ink-muted"><tr><th className="px-4 py-3 text-left">Part no.</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Section</th><th className="px-4 py-3 text-right">Ex VAT</th><th className="px-4 py-3 text-right">Inc VAT</th></tr></thead>
              <tbody>{miniRows.slice(0, limit).map((product) => <tr key={product.id} className="border-t border-racing/5"><td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-racing">{product.code}</td><td className="px-4 py-3"><div className="font-medium text-racing">{product.name}</div><div className="text-xs text-ink-muted">{product.fits}</div></td><td className="px-4 py-3 text-sm text-ink-muted">{product.section}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceExVat)}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceIncVat)}</td></tr>)}</tbody>
            </table>
          ) : (
            <table className="w-full min-w-[920px]">
              <thead className="text-xs uppercase tracking-wider text-ink-muted"><tr><th className="px-4 py-3 text-left">Shape</th><th className="px-4 py-3 text-left">Metal</th><th className="px-4 py-3 text-left">Spec.</th><th className="px-4 py-3 text-left">Size</th><th className="px-4 py-3 text-left">Unit</th><th className="px-4 py-3 text-right">Ex VAT</th><th className="px-4 py-3 text-right">Inc VAT</th></tr></thead>
              <tbody>{metalRows.slice(0, limit).map((product) => <tr key={product.id} className="border-t border-racing/5"><td className="px-4 py-3 font-medium text-racing">{product.form}</td><td className="px-4 py-3">{product.metal}</td><td className="px-4 py-3 text-ink-muted">{product.spec || "-"}</td><td className="px-4 py-3">{product.size}</td><td className="whitespace-nowrap px-4 py-3 text-ink-muted">{product.unit}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceExVat)}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceIncVat)}</td></tr>)}</tbody>
            </table>
          )}
          {rows.length === 0 && <div className="px-4 py-12 text-center text-sm text-ink-muted">No catalogue lines match that search.</div>}
        </div>
        {limit < rows.length && <div className="border-t border-racing/10 bg-cream-dark p-4 text-center"><button type="button" onClick={() => setLimit((value) => value + 40)} className="btn-secondary text-sm">Show more ({rows.length - limit} remaining)</button></div>}
      </div>
    </div>
  );
}

function money(value: number | null | undefined) {
  return typeof value === "number" ? `\u00a3${value.toFixed(2)}` : "POA";
}
