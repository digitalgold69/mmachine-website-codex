"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { metals, metalCategories } from "@/lib/metals-data";

export default function MetalsCataloguePage() {
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = metals;
    if (cat !== "all") list = list.filter((p) => p.category === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cat, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">← Home</Link>
        <h1 className="font-display text-4xl text-racing mt-2 mb-2">Engineering metals</h1>
        <p className="text-ink-muted max-w-2xl">
          Tool steels, stainless, aluminium, brass and bronze. Cut to size from stock.
          All materials UK-sourced where possible. Same-day despatch on orders placed before noon.
        </p>
      </div>

      <div className="bg-gradient-to-br from-cream-dark to-cream rounded-2xl p-8 mb-8 border border-racing/10">
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <div className="font-display text-2xl text-racing">900+</div>
            <div className="text-sm text-ink-muted">Grades in stock</div>
          </div>
          <div>
            <div className="font-display text-2xl text-racing">Same-day</div>
            <div className="text-sm text-ink-muted">Despatch before noon</div>
          </div>
          <div>
            <div className="font-display text-2xl text-racing">Free</div>
            <div className="text-sm text-ink-muted">Material advice</div>
          </div>
          <div>
            <div className="font-display text-2xl text-racing">Cut-to-size</div>
            <div className="text-sm text-ink-muted">Any length, any quantity</div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setCat("all")}
            className={`chip transition-colors ${cat === "all" ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
          >
            All metals ({metals.length})
          </button>
          {metalCategories.map((c) => {
            const count = metals.filter((m) => m.category === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`chip transition-colors ${cat === c.key ? "!bg-racing !text-cream" : "hover:!bg-gold/20"}`}
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
          placeholder="Search by grade (e.g. 'EN24', 'stainless', '316')"
          className="input max-w-lg"
        />
      </div>

      <div className="bg-white rounded-xl border border-racing/10 overflow-hidden">
        {/* DESKTOP TABLE — md and up. Fixed column widths so Material doesn't push everything else. */}
        <div className="hidden md:block">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[14%]" />
              <col />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="text-left px-4 py-3">Grade</th>
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-left px-4 py-3">Form</th>
                <th className="text-left px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">From</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-racing font-semibold whitespace-nowrap align-top">{p.code}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-racing leading-snug">{p.name}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{p.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted truncate align-top" title={p.form}>{p.form}</td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <span className={`stock-badge stock-${p.stock}`}>
                      {p.stock === "in" ? "In stock" : p.stock === "low" ? "Low" : "Out"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-racing whitespace-nowrap align-top">
                    {p.pricePerKg ? <>£{p.pricePerKg.toFixed(2)}<span className="text-xs text-ink-muted">/kg</span></> : <span className="text-xs text-ink-muted italic">POA</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-ink-muted">No grades match that search. Call us on 01325 381302 — we stock more than this list shows.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS — under md. No horizontal scroll needed. */}
        <div className="md:hidden divide-y divide-racing/5">
          {filtered.map((p) => (
            <div key={p.id} className="p-4 hover:bg-cream-dark/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="font-medium text-racing leading-snug">{p.name}</div>
                <div className="font-semibold text-racing whitespace-nowrap text-right">
                  {p.pricePerKg ? <>£{p.pricePerKg.toFixed(2)}<span className="text-xs text-ink-muted">/kg</span></> : <span className="text-xs text-ink-muted italic">POA</span>}
                </div>
              </div>
              <div className="text-xs text-ink-muted mb-2">{p.description}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-mono text-racing">{p.code}</span>
                <span className="text-ink-muted">{p.form}</span>
                <span className={`stock-badge stock-${p.stock} ml-auto`}>
                  {p.stock === "in" ? "In stock" : p.stock === "low" ? "Low" : "Out"}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-muted px-4">
              No grades match that search. Call us on 01325 381302 — we stock more than this list shows.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-cream-dark rounded-xl p-6 border-l-4 border-gold">
        <h3 className="font-display text-lg text-racing mb-2">Need technical advice?</h3>
        <p className="text-sm text-ink-muted mb-3">
          Our engineers are happy to help with material selection — tool steel hardness, stainless grade for marine use,
          aluminium alloys for weight-critical work. Just give us a call.
        </p>
        <Link href="/contact" className="text-sm font-medium text-racing hover:text-gold">
          Get in touch →
        </Link>
      </div>
    </div>
  );
}
