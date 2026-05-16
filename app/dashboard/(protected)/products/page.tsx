"use client";

import { useMemo, useState } from "react";
import { products as initialProducts, sections } from "@/lib/mini-data";
import type { Product, StockLevel } from "@/lib/mini-data";
import { metalCategories, metals as initialMetals } from "@/lib/metals-data";
import type { MetalProduct } from "@/lib/metals-data";

const GBP = "\u00a3";

type Catalogue = "mini" | "metals";
type Editing =
  | { catalogue: "mini"; item: Product }
  | { catalogue: "metals"; item: MetalProduct };

export default function DashboardProductsPage() {
  const [miniItems, setMiniItems] = useState<Product[]>(initialProducts);
  const [metalItems, setMetalItems] = useState<MetalProduct[]>(initialMetals);
  const [catalogue, setCatalogue] = useState<Catalogue>("mini");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [limit, setLimit] = useState(30);

  const miniFiltered = useMemo(() => {
    let list = miniItems;
    if (categoryFilter !== "all") list = list.filter((p) => p.section === categoryFilter);
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
  }, [miniItems, categoryFilter, stockFilter, search]);

  const metalFiltered = useMemo(() => {
    let list = metalItems;
    if (categoryFilter !== "all") list = list.filter((p) => p.category === categoryFilter);
    if (stockFilter !== "all") list = list.filter((p) => p.stock === stockFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.form.toLowerCase().includes(q) ||
          p.metal.toLowerCase().includes(q) ||
          p.spec.toLowerCase().includes(q) ||
          p.size.toLowerCase().includes(q)
      );
    }
    return list;
  }, [metalItems, categoryFilter, stockFilter, search]);

  const filteredCount = catalogue === "mini" ? miniFiltered.length : metalFiltered.length;
  const totalCount = catalogue === "mini" ? miniItems.length : metalItems.length;

  function switchCatalogue(next: Catalogue) {
    setCatalogue(next);
    setSearch("");
    setCategoryFilter("all");
    setStockFilter("all");
    setLimit(30);
    setEditing(null);
  }

  function saveMini(updated: Product) {
    setMiniItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    setEditing(null);
  }

  function saveMetal(updated: MetalProduct) {
    setMetalItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    setEditing(null);
  }

  if (editing?.catalogue === "mini") {
    return <EditMiniForm product={editing.item} onSave={saveMini} onCancel={() => setEditing(null)} />;
  }

  if (editing?.catalogue === "metals") {
    return <EditMetalForm product={editing.item} onSave={saveMetal} onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-racing">Products</h1>
          <p className="text-ink-muted text-sm">
            {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} {catalogue === "mini" ? "Mini panel" : "metal"} lines
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-racing/10 bg-white p-1">
        <button
          type="button"
          onClick={() => switchCatalogue("mini")}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "mini" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}
        >
          Mini panels ({miniItems.length.toLocaleString()})
        </button>
        <button
          type="button"
          onClick={() => switchCatalogue("metals")}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "metals" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}
        >
          Metals ({metalItems.length.toLocaleString()})
        </button>
      </div>

      <div className="bg-white rounded-xl border border-racing/10 p-4 mb-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <input
            type="search"
            placeholder={catalogue === "mini" ? "Search code, name, or fitment..." : "Search shape, metal, spec, size, or code..."}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(30);
            }}
            className="input"
          />
          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setLimit(30);
            }}
          >
            <option value="all">{catalogue === "mini" ? "All sections" : "All metal categories"}</option>
            {catalogue === "mini"
              ? sections.map((s) => <option key={s.code} value={s.code}>{s.code} - {s.label}</option>)
              : metalCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select
            className="input"
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setLimit(30);
            }}
          >
            <option value="all">All stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
      </div>

      {catalogue === "mini" ? (
        <MiniTable
          rows={miniFiltered.slice(0, limit)}
          total={miniFiltered.length}
          limit={limit}
          onMore={() => setLimit(limit + 30)}
          onEdit={(item) => setEditing({ catalogue: "mini", item })}
        />
      ) : (
        <MetalTable
          rows={metalFiltered.slice(0, limit)}
          total={metalFiltered.length}
          limit={limit}
          onMore={() => setLimit(limit + 30)}
          onEdit={(item) => setEditing({ catalogue: "metals", item })}
        />
      )}

      <p className="text-xs text-ink-muted mt-4">
        Product edits here are dashboard-side edits. The production source of truth remains the uploaded master spreadsheets.
      </p>
    </div>
  );
}

function MiniTable({
  rows,
  total,
  limit,
  onMore,
  onEdit,
}: {
  rows: Product[];
  total: number;
  limit: number;
  onMore: () => void;
  onEdit: (item: Product) => void;
}) {
  return (
    <ProductShell total={total} shown={rows.length} limit={limit} onMore={onMore}>
      <table className="w-full min-w-[860px]">
        <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="text-left px-4 py-3">Code</th>
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Section</th>
            <th className="text-left px-4 py-3">Stock</th>
            <th className="text-right px-4 py-3">Price ex VAT</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const sec = sections.find((s) => s.code === p.section);
            return (
              <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/30">
                <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{p.code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-racing">{p.name}</div>
                  <div className="text-xs text-ink-muted">{p.fits}</div>
                </td>
                <td className="px-4 py-3 text-sm text-ink-muted">
                  <span className="font-mono text-xs bg-cream-dark px-2 py-0.5 rounded mr-2">{p.section}</span>
                  {sec?.label}
                </td>
                <td className="px-4 py-3"><StockBadge stock={p.stock} qty={p.stockQty} /></td>
                <td className="px-4 py-3 text-right font-semibold text-racing whitespace-nowrap">{money(p.priceExVat)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onEdit(p)} className="btn-secondary text-xs py-1 px-3">Edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ProductShell>
  );
}

function MetalTable({
  rows,
  total,
  limit,
  onMore,
  onEdit,
}: {
  rows: MetalProduct[];
  total: number;
  limit: number;
  onMore: () => void;
  onEdit: (item: MetalProduct) => void;
}) {
  return (
    <ProductShell total={total} shown={rows.length} limit={limit} onMore={onMore}>
      <table className="w-full min-w-[960px]">
        <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="text-left px-4 py-3">Shape</th>
            <th className="text-left px-4 py-3">Metal</th>
            <th className="text-left px-4 py-3">Spec</th>
            <th className="text-left px-4 py-3">Size</th>
            <th className="text-left px-4 py-3">Unit</th>
            <th className="text-right px-4 py-3">Price ex VAT</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-racing/5 hover:bg-cream-dark/30">
              <td className="px-4 py-3 font-medium text-racing">{p.form}</td>
              <td className="px-4 py-3">{p.metal}</td>
              <td className="px-4 py-3">{p.spec}</td>
              <td className="px-4 py-3">{p.size}</td>
              <td className="px-4 py-3">{p.unit}</td>
              <td className="px-4 py-3 text-right font-semibold text-racing whitespace-nowrap">{money(p.priceExVat)}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onEdit(p)} className="btn-secondary text-xs py-1 px-3">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ProductShell>
  );
}

function ProductShell({
  children,
  total,
  shown,
  limit,
  onMore,
}: {
  children: React.ReactNode;
  total: number;
  shown: number;
  limit: number;
  onMore: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-racing/10 overflow-hidden">
      <div className="overflow-x-auto">
        {shown === 0 ? (
          <div className="text-center py-12 text-ink-muted">No products match these filters.</div>
        ) : (
          children
        )}
      </div>
      {shown < total && (
        <div className="bg-cream-dark border-t border-racing/10 p-4 text-center">
          <button onClick={onMore} className="btn-secondary text-sm">
            Show more ({Math.max(0, total - limit)} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function EditMiniForm({
  product,
  onSave,
  onCancel,
}: {
  product: Product;
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(product);
  const update = <K extends keyof Product>(field: K, value: Product[K]) => setForm({ ...form, [field]: value });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceIncVat = typeof form.priceExVat === "number" ? Math.round(form.priceExVat * 1.2 * 100) / 100 : null;
    onSave({ ...form, priceIncVat });
  }

  return (
    <ProductFormShell title="Edit Mini panel" onCancel={onCancel} onSubmit={handleSubmit}>
      <div>
        <label className="label">Product code</label>
        <input className="input" value={form.code} onChange={(e) => update("code", e.target.value)} required />
      </div>
      <div>
        <label className="label">Section</label>
        <select className="input" value={form.section} onChange={(e) => update("section", e.target.value)}>
          {sections.map((s) => <option key={s.code} value={s.code}>{s.code} - {s.label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Product name</label>
        <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Fits / applicability</label>
        <input className="input" value={form.fits} onChange={(e) => update("fits", e.target.value)} />
      </div>
      <MiniStockFields form={form} update={update} />
    </ProductFormShell>
  );
}

function EditMetalForm({
  product,
  onSave,
  onCancel,
}: {
  product: MetalProduct;
  onSave: (p: MetalProduct) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(product);
  const update = <K extends keyof MetalProduct>(field: K, value: MetalProduct[K]) => setForm({ ...form, [field]: value });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceIncVat = typeof form.priceExVat === "number" ? Math.round(form.priceExVat * 1.2 * 100) / 100 : null;
    onSave({ ...form, priceIncVat, pricePerKg: form.priceExVat, description: form.name });
  }

  return (
    <ProductFormShell title="Edit metal line" onCancel={onCancel} onSubmit={handleSubmit}>
      <div>
        <label className="label">Shape</label>
        <input className="input" value={form.form} onChange={(e) => update("form", e.target.value)} required />
      </div>
      <div>
        <label className="label">Metal</label>
        <input className="input" value={form.metal} onChange={(e) => update("metal", e.target.value)} required />
      </div>
      <div>
        <label className="label">Spec</label>
        <input className="input" value={form.spec} onChange={(e) => update("spec", e.target.value)} />
      </div>
      <div>
        <label className="label">Size</label>
        <input className="input" value={form.size} onChange={(e) => update("size", e.target.value)} required />
      </div>
      <div>
        <label className="label">Unit</label>
        <input className="input" value={form.unit} onChange={(e) => update("unit", e.target.value)} />
      </div>
      <div>
        <label className="label">Category</label>
        <select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
          {metalCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Price ex VAT ({GBP})</label>
        <input
          type="number"
          step="0.01"
          className="input"
          value={form.priceExVat ?? ""}
          onChange={(e) => update("priceExVat", e.target.value ? Number(e.target.value) : null)}
        />
      </div>
      <div>
        <label className="label">Stock status</label>
        <select className="input" value={form.stock} onChange={(e) => update("stock", e.target.value as MetalProduct["stock"])}>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Display name</label>
        <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
      </div>
    </ProductFormShell>
  );
}

function ProductFormShell({
  title,
  children,
  onCancel,
  onSubmit,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div>
      <button onClick={onCancel} className="text-sm text-ink-muted hover:text-racing mb-3">Back to products</button>
      <h1 className="font-display text-3xl text-racing mb-6">{title}</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-racing/10 p-6 max-w-4xl">
        <div className="grid sm:grid-cols-2 gap-4">{children}</div>
        <div className="flex gap-3 mt-6 pt-6 border-t border-racing/10">
          <button type="submit" className="btn-primary">Save changes</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function MiniStockFields({
  form,
  update,
}: {
  form: Product;
  update: <K extends keyof Product>(field: K, value: Product[K]) => void;
}) {
  return (
    <>
      <div>
        <label className="label">Price ex VAT ({GBP})</label>
        <input
          type="number"
          step="0.01"
          className="input"
          value={form.priceExVat ?? ""}
          onChange={(e) => update("priceExVat", e.target.value ? Number(e.target.value) : null)}
        />
      </div>
      <div>
        <label className="label">Stock quantity</label>
        <input
          type="number"
          className="input"
          value={form.stockQty}
          onChange={(e) => {
            const qty = Number(e.target.value) || 0;
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
    </>
  );
}

function StockBadge({ stock, qty }: { stock: StockLevel; qty?: number }) {
  return (
    <span className={`stock-badge stock-${stock}`}>
      {stock === "in" ? `In${typeof qty === "number" ? ` (${qty})` : ""}` : stock === "low" ? `Low${typeof qty === "number" ? ` (${qty})` : ""}` : "Out"}
    </span>
  );
}

function money(value: number | null | undefined) {
  return typeof value === "number" ? `${GBP}${value.toFixed(2)}` : <span className="text-xs italic">POA</span>;
}
