"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { metals, metalCategories, type MetalProduct } from "@/lib/metals-data";

const formatPrice = (value: number | null) =>
  value === null ? "POA" : `£${value.toFixed(2)}`;

const categoryLabel = (key: string) =>
  metalCategories.find((category) => category.key === key)?.label ?? key;

const searchableText = (product: MetalProduct) =>
  [
    product.form,
    product.metal,
    product.spec,
    product.size,
    product.unit,
    product.code,
    product.sourceSheet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function MetalsCataloguePage() {
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = metals;
    if (cat !== "all") list = list.filter((p) => p.category === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => searchableText(p).includes(q));
    }
    return list;
  }, [cat, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">
          &larr; Home
        </Link>
        <h1 className="font-display text-4xl text-racing mt-2 mb-2">
          Metals catalogue
        </h1>
        <p className="text-ink-muted max-w-3xl">
          Browse the metals catalogue in the same column format as the printed
          customer catalogue. Prices are shown ex VAT and inc VAT.
        </p>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setCat("all")}
            className={`chip transition-colors ${
              cat === "all" ? "!bg-racing !text-cream" : "hover:!bg-gold/20"
            }`}
          >
            All metals ({metals.length})
          </button>
          {metalCategories.map((c) => {
            const count = metals.filter((m) => m.category === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`chip transition-colors ${
                  cat === c.key ? "!bg-racing !text-cream" : "hover:!bg-gold/20"
                }`}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by shape, metal, spec, size, or unit"
          className="input max-w-2xl"
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-muted">
          Showing <strong className="text-racing">{filtered.length}</strong> of{" "}
          <strong className="text-racing">{metals.length}</strong> catalogue
          lines
          {cat !== "all" && ` in ${categoryLabel(cat)}`}
        </p>
        <a
          href="/catalogue/metals-catalogue.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm"
        >
          Download full PDF catalogue
        </a>
      </div>

      <div className="bg-white rounded-xl border border-racing/10 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="text-left px-4 py-3">Shape</th>
                <th className="text-left px-4 py-3">Metal</th>
                <th className="text-left px-4 py-3">Spec.</th>
                <th className="text-left px-4 py-3">Size</th>
                <th className="text-right px-4 py-3">£ ex VAT</th>
                <th className="text-left px-4 py-3">Unit</th>
                <th className="text-right px-4 py-3">£ Inc VAT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-racing/5 hover:bg-cream-dark/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-racing font-medium align-top">
                    {p.form || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink align-top">
                    {p.metal || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted align-top">
                    {p.spec || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink align-top">
                    {p.size || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-racing whitespace-nowrap align-top">
                    {formatPrice(p.priceExVat)}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted whitespace-nowrap align-top">
                    {p.unit || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-racing whitespace-nowrap align-top">
                    {formatPrice(p.priceIncVat)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-ink-muted">
                    No catalogue lines match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden divide-y divide-racing/5">
          {filtered.map((p) => (
            <div key={p.id} className="p-4 hover:bg-cream-dark/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-racing leading-snug">
                    {p.form} {p.metal}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {[p.spec, p.size].filter(Boolean).join(" - ")}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold text-racing">
                    {formatPrice(p.priceExVat)}
                  </div>
                  <div className="text-xs text-ink-muted">ex VAT</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <div className="uppercase tracking-wider text-ink-muted">Shape</div>
                  <div className="text-ink">{p.form || "-"}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wider text-ink-muted">Unit</div>
                  <div className="text-ink">{p.unit || "-"}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wider text-ink-muted">£ Inc VAT</div>
                  <div className="font-semibold text-racing">
                    {formatPrice(p.priceIncVat)}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wider text-ink-muted">Source</div>
                  <div className="text-ink">{categoryLabel(p.category)}</div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-muted px-4">
              No catalogue lines match that search.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-cream-dark rounded-xl p-6 border-l-4 border-gold">
        <h3 className="font-display text-lg text-racing mb-2">
          Need technical advice?
        </h3>
        <p className="text-sm text-ink-muted mb-3">
          Call 01325 381302 if you need help choosing a metal, size, or cut
          length.
        </p>
        <Link href="/contact" className="text-sm font-medium text-racing hover:text-gold">
          Get in touch &rarr;
        </Link>
      </div>
    </div>
  );
}
