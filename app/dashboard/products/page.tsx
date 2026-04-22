"use client";

import { useMemo, useState } from "react";
import { products as initialProducts, sections } from "@/lib/mini-data";
import type { Product, StockLevel } from "@/lib/mini-data";

export default function DashboardProductsPage() {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [limit, setLimit] = useState(25);

  const filtered = useMemo(() => {
    let list = items;
    if (sectionFilter !== "all") list = list.filter((p) => p.section === sectionFilter);
    if (stockFilter !== "all") list = list.filter((p) => p.stock === stockFilter);
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
  }, [items, sectionFilter, stockFilter, search]);

  const handleSave = (updated: Product) => {
    setItems(items.map((p) => (p.id === updated.id ? updated : p)));
    setEditing(null);
  };

  const handleAdd = () => {
    setEditing({
      id: `new-${Date.now()}`,
      code: "",
      name: "",
      section: "120",
      fits: "All Minis",
      bodyType: null,
      mark: null,
      hand: null,
      priceExVat: 0,
      priceIncVat: 0,
      stock: "in",
      stockQty: 0,
      category: "mini",
    });
  };

  if (editing) {
    return <EditProductForm product={editing} onSave={handleSave} onCancel={() => setEditing(null)} />;
  }

  const shown = filtered.slice(0, limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-racing">Products</h1>
          <p className="text-ink-muted text-sm">{filtered.length} of {items.length} products</p>
        </div>
        <button onClick={handleAdd} className="btn-primary">+ Add new product</button>
      </div>

      <div className="bg-white rounded-xl border border-racing/10 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search by code, name, or what it fits…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLimit(25); }}
            className="input flex-1 min-w-[260px]"
          />
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="btn-secondary text-sm py-2">
            {showAdvanced ? "Hide" : "Show"} advanced
          </button>
        </div>
        {showAdvanced && (
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-racing/10">
            <div>
              <label className="label">Section</label>
              <select className="input" value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setLimit(25); }}>
                <option value="all">All sections</option>
                {sections.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stock status</label>
              <select className="input" value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setLimit(25); }}>
                <option value="all">All stock levels</option>
                <option value="in">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-racing/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Section</th>
                <th className="text-left px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const sec = sections.find((s) => s.code === p.section);
                return (
                  <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/30">
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{p.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-racing">{p.name}</div>
                      <div className="text-xs text-ink-muted md:hidden">{p.fits}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted hidden md:table-cell">
                      <span className="font-mono text-xs bg-cream-dark px-2 py-0.5 rounded mr-2">{p.section}</span>
                      {sec?.label}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`stock-badge stock-${p.stock}`}>
                        {p.stock === "in" ? `In (${p.stockQty})` : p.stock === "low" ? `Low (${p.stockQty})` : "Out"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-racing whitespace-nowrap">
                      {p.priceExVat !== null ? `£${p.priceExVat.toFixed(2)}` : <span className="text-xs italic">POA</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditing(p)} className="btn-secondary text-xs py-1 px-3">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-ink-muted">No products match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {shown.length < filtered.length && (
          <div className="bg-cream-dark border-t border-racing/10 p-4 text-center">
            <button onClick={() => setLimit(limit + 25)} className="btn-secondary text-sm">
              Show more ({filtered.length - shown.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditProductForm({ product, onSave, onCancel }: { product: Product; onSave: (p: Product) => void; onCancel: () => void }) {
  const [form, setForm] = useState(product);
  const isNew = product.id.startsWith("new-");

  const update = <K extends keyof Product>(field: K, value: Product[K]) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.priceExVat) {
      form.priceIncVat = Math.round(form.priceExVat * 1.2 * 100) / 100;
    }
    onSave(form);
  };

  return (
    <div>
      <button onClick={onCancel} className="text-sm text-ink-muted hover:text-racing mb-3">← Back to products</button>
      <h1 className="font-display text-3xl text-racing mb-6">{isNew ? "Add new product" : "Edit product"}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-racing/10 p-6 max-w-3xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Product code *</label>
            <input className="input" value={form.code} onChange={(e) => update("code", e.target.value)} required />
          </div>
          <div>
            <label className="label">Section</label>
            <select className="input" value={form.section} onChange={(e) => update("section", e.target.value)}>
              {sections.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Product name *</label>
            <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Fits / applicability</label>
            <input className="input" value={form.fits} onChange={(e) => update("fits", e.target.value)} placeholder="e.g. Saloon, Mark I" />
          </div>
          <div>
            <label className="label">Hand</label>
            <select className="input" value={form.hand ?? ""} onChange={(e) => update("hand", e.target.value || null)}>
              <option value="">—</option>
              <option value="unhanded">Unhanded</option>
              <option value="LH">Left-hand</option>
              <option value="RH">Right-hand</option>
              <option value="LH assembly">LH assembly</option>
              <option value="RH assembly">RH assembly</option>
            </select>
          </div>
          <div>
            <label className="label">Price ex VAT (£)</label>
            <input
              type="number" step="0.01" className="input"
              value={form.priceExVat ?? ""}
              onChange={(e) => update("priceExVat", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="label">Stock quantity</label>
            <input
              type="number" className="input" value={form.stockQty}
              onChange={(e) => {
                const qty = parseInt(e.target.value) || 0;
                update("stockQty", qty);
                if (qty === 0) update("stock", "out" as StockLevel);
                else if (qty < 4) update("stock", "low" as StockLevel);
                else update("stock", "in" as StockLevel);
              }}
            />
          </div>
          <div>
            <label className="label">Stock status</label>
            <select className="input" value={form.stock} onChange={(e) => update("stock", e.target.value as StockLevel)}>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-racing/10">
          <button type="submit" className="btn-primary">Save changes</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          {!isNew && (
            <button
              type="button"
              onClick={() => { if (confirm("Delete this product? This can't be undone.")) { onCancel(); } }}
              className="ml-auto text-sm text-red-700 hover:underline"
            >
              Delete product
            </button>
          )}
        </div>
      </form>

      <p className="text-xs text-ink-muted mt-4 max-w-3xl">
        <strong>Note:</strong> this is a demo. In the live site, clicking Save will update the database and push changes to the public catalogue immediately.
      </p>
    </div>
  );
}
