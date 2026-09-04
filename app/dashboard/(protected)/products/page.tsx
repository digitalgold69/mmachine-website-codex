"use client";

import { useEffect, useMemo, useState } from "react";
import { products, sections } from "@/lib/mini-data";
import { metalCategories, metals } from "@/lib/metals-data";
import { MANUAL_MINI_SECTION_CODE } from "@/lib/manual-mini-product-shared";

type Catalogue = "mini" | "metals" | "manual";
type MiniProduct = (typeof products)[number];

type MiniProductImage = {
  productId: string;
  url: string;
  uploadedAt: string;
};

type ManualMiniProduct = MiniProduct & {
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProductPreviewImage = MiniProductImage & {
  alt: string;
};

type ImageAction = {
  productId: string;
  text: string;
  tone: "loading" | "success" | "error";
} | null;

type ManualDraft = {
  id: string;
  code: string;
  name: string;
  section: string;
  fits: string;
  priceExVat: string;
  active: boolean;
};

const EMPTY_MANUAL_DRAFT: ManualDraft = {
  id: "",
  code: "",
  name: "",
  section: "120",
  fits: "",
  priceExVat: "",
  active: true,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for optimisation."));
    image.src = url;
  });
}

async function optimiseProductImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Choose a photo under 12 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not optimise image in this browser.");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/webp", 0.84);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function DashboardProductsPage() {
  const [catalogue, setCatalogue] = useState<Catalogue>("mini");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(40);
  const [miniProductImages, setMiniProductImages] = useState<Record<string, MiniProductImage>>({});
  const [manualProducts, setManualProducts] = useState<ManualMiniProduct[]>([]);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(EMPTY_MANUAL_DRAFT);
  const [manualAction, setManualAction] = useState<{ text: string; tone: "loading" | "success" | "error" } | null>(null);
  const [imagePreview, setImagePreview] = useState<ProductPreviewImage | null>(null);
  const [imageAction, setImageAction] = useState<ImageAction>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/mini-product-images", { cache: "no-store" })
      .then(async (response): Promise<{ images?: MiniProductImage[] } | null> =>
        response.ok ? (await response.json()) as { images?: MiniProductImage[] } : null
      )
      .then((data: { images?: MiniProductImage[] } | null) => {
        if (cancelled || !Array.isArray(data?.images)) return;
        setMiniProductImages(Object.fromEntries(data.images.map((image) => [image.productId, image])));
      })
      .catch(() => {
        if (!cancelled) setMiniProductImages({});
      });

    fetch("/api/manual-mini-products", { cache: "no-store" })
      .then(async (response): Promise<{ products?: ManualMiniProduct[] } | null> =>
        response.ok ? (await response.json()) as { products?: ManualMiniProduct[] } : null
      )
      .then((data: { products?: ManualMiniProduct[] } | null) => {
        if (cancelled || !Array.isArray(data?.products)) return;
        setManualProducts(data.products);
      })
      .catch(() => {
        if (!cancelled) setManualProducts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const manualRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return manualProducts.filter((product) =>
      (category === "all" || product.section === category) &&
      (!query || [product.code, product.name, product.fits].join(" ").toLowerCase().includes(query))
    );
  }, [category, manualProducts, search]);

  const rows = catalogue === "mini" ? miniRows : catalogue === "metals" ? metalRows : manualRows;
  const total = catalogue === "mini" ? products.length : catalogue === "metals" ? metals.length : manualProducts.length;

  function switchCatalogue(next: Catalogue) {
    setCatalogue(next);
    setSearch("");
    setCategory("all");
    setLimit(40);
  }

  async function uploadMiniProductImage(productId: string, file: File | null) {
    if (!file) return;
    setImageAction({ productId, text: "Optimising...", tone: "loading" });

    try {
      const imageDataUrl = await optimiseProductImage(file);
      setImageAction({ productId, text: "Uploading...", tone: "loading" });
      const response = await fetch("/api/mini-product-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, imageDataUrl }),
      });
      const data = await response.json() as { image?: MiniProductImage; error?: string };
      if (!response.ok || !data.image) throw new Error(data.error || "Image upload failed.");

      setMiniProductImages((current) => ({ ...current, [data.image!.productId]: data.image! }));
      setImageAction({ productId, text: "Saved", tone: "success" });
    } catch (error) {
      setImageAction({ productId, text: (error as Error).message || "Upload failed", tone: "error" });
    }
  }

  async function removeMiniProductImage(productId: string) {
    setImageAction({ productId, text: "Removing...", tone: "loading" });

    try {
      const response = await fetch("/api/mini-product-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Image could not be removed.");

      setMiniProductImages((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setImageAction({ productId, text: "Removed", tone: "success" });
    } catch (error) {
      setImageAction({ productId, text: (error as Error).message || "Remove failed", tone: "error" });
    }
  }

  async function saveManualProduct() {
    setManualAction({ text: "Saving...", tone: "loading" });
    try {
      const response = await fetch("/api/manual-mini-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualDraft),
      });
      const data = await response.json() as { product?: ManualMiniProduct; error?: string };
      if (!response.ok || !data.product) throw new Error(data.error || "Manual Mini part could not be saved.");

      setManualProducts((current) => {
        const withoutExisting = current.filter((product) => product.id !== data.product!.id);
        return [data.product!, ...withoutExisting];
      });
      setManualDraft(EMPTY_MANUAL_DRAFT);
      setManualAction({ text: "Saved", tone: "success" });
    } catch (error) {
      setManualAction({ text: (error as Error).message || "Save failed", tone: "error" });
    }
  }

  async function deleteManualProduct(productId: string) {
    setManualAction({ text: "Removing...", tone: "loading" });
    try {
      const response = await fetch("/api/manual-mini-products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Manual Mini part could not be removed.");

      setManualProducts((current) => current.filter((product) => product.id !== productId));
      if (manualDraft.id === productId) setManualDraft(EMPTY_MANUAL_DRAFT);
      setManualAction({ text: "Removed", tone: "success" });
    } catch (error) {
      setManualAction({ text: (error as Error).message || "Remove failed", tone: "error" });
    }
  }

  function editManualProduct(product: ManualMiniProduct) {
    setManualDraft({
      id: product.id,
      code: product.code,
      name: product.name,
      section: product.section,
      fits: product.fits || "",
      priceExVat: typeof product.priceExVat === "number" ? product.priceExVat.toFixed(2) : "",
      active: product.active !== false,
    });
    setManualAction(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing">Catalogue lookup</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Check the product details and prices currently shown on the website.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-racing/10 bg-white p-1">
        <button type="button" onClick={() => switchCatalogue("mini")} aria-pressed={catalogue === "mini"} className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "mini" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}>
          Mini panels ({products.length.toLocaleString("en-GB")})
        </button>
        <button type="button" onClick={() => switchCatalogue("metals")} aria-pressed={catalogue === "metals"} className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "metals" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}>
          Metals ({metals.length.toLocaleString("en-GB")})
        </button>
        <button type="button" onClick={() => switchCatalogue("manual")} aria-pressed={catalogue === "manual"} className={`rounded-md px-4 py-2 text-sm font-semibold ${catalogue === "manual" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"}`}>
          Manually added ({manualProducts.length.toLocaleString("en-GB")})
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
              <option value="all">{catalogue === "metals" ? "All metal categories" : "All Mini sections"}</option>
              {catalogue === "mini" || catalogue === "manual"
                ? sections.map((section) => <option key={section.code} value={section.code}>{section.code} - {section.label}</option>)
                : metalCategories.map((metal) => <option key={metal.key} value={metal.key}>{metal.label}</option>)}
              {catalogue === "manual" && <option value={MANUAL_MINI_SECTION_CODE}>Other</option>}
            </select>
          </div>
        </div>
      </div>

      {catalogue === "manual" && (
        <div className="mb-4 rounded-xl border border-racing/10 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-racing">
                {manualDraft.id ? "Edit manual Mini part" : "Add manual Mini part"}
              </h2>
              <p className="text-sm text-ink-muted">
                These parts are stored in the dashboard and are not overwritten by the daily Excel sync.
              </p>
            </div>
            {manualDraft.id && (
              <button type="button" onClick={() => setManualDraft(EMPTY_MANUAL_DRAFT)} className="btn-secondary text-sm">
                New part
              </button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[140px_1fr_220px_140px]">
            <div>
              <label htmlFor="manual-code" className="label">Part no.</label>
              <input id="manual-code" value={manualDraft.code} onChange={(event) => setManualDraft((draft) => ({ ...draft, code: event.target.value }))} className="input" placeholder="e.g. 99.99.99" />
            </div>
            <div>
              <label htmlFor="manual-name" className="label">Description</label>
              <input id="manual-name" value={manualDraft.name} onChange={(event) => setManualDraft((draft) => ({ ...draft, name: event.target.value }))} className="input" placeholder="Part description" />
            </div>
            <div>
              <label htmlFor="manual-section" className="label">Section</label>
              <select id="manual-section" value={manualDraft.section} onChange={(event) => setManualDraft((draft) => ({ ...draft, section: event.target.value }))} className="input">
                {sections.map((section) => (
                  <option key={section.code} value={section.code}>{section.code} - {section.label}</option>
                ))}
                <option value={MANUAL_MINI_SECTION_CODE}>Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="manual-price" className="label">Ex VAT</label>
              <input id="manual-price" value={manualDraft.priceExVat} onChange={(event) => setManualDraft((draft) => ({ ...draft, priceExVat: event.target.value }))} className="input" inputMode="decimal" placeholder="POA" />
            </div>
            <div className="lg:col-span-3">
              <label htmlFor="manual-fits" className="label">Fitment / notes</label>
              <input id="manual-fits" value={manualDraft.fits} onChange={(event) => setManualDraft((draft) => ({ ...draft, fits: event.target.value }))} className="input" placeholder="Optional fitment note shown under the part title" />
            </div>
            <label className="flex min-h-[46px] items-center gap-2 rounded-md border border-racing/10 px-3 text-sm font-semibold text-racing">
              <input
                type="checkbox"
                checked={manualDraft.active}
                onChange={(event) => setManualDraft((draft) => ({ ...draft, active: event.target.checked }))}
                className="h-4 w-4 accent-racing"
              />
              Active
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void saveManualProduct()} className="btn-primary">
              {manualDraft.id ? "Save changes" : "Add part"}
            </button>
            {manualAction && (
              <span className={`text-sm font-semibold ${manualAction.tone === "error" ? "text-red-700" : manualAction.tone === "success" ? "text-green-800" : "text-ink-muted"}`}>
                {manualAction.text}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-racing/10 bg-white">
        <div className="border-b border-racing/10 bg-cream-dark px-4 py-3 text-sm text-ink-muted">
          Showing {Math.min(limit, rows.length).toLocaleString("en-GB")} of {rows.length.toLocaleString("en-GB")} matching lines ({total.toLocaleString("en-GB")} total)
        </div>
        <div className="overflow-x-auto">
          {catalogue === "manual" ? (
            <table className="w-full min-w-[1040px]">
              <thead className="text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Part no.</th>
                  <th className="px-4 py-3 text-left">Photo</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ex VAT</th>
                  <th className="px-4 py-3 text-right">Inc VAT</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manualRows.slice(0, limit).map((product) => {
                  const image = miniProductImages[product.id];
                  const action = imageAction?.productId === product.id ? imageAction : null;
                  return (
                    <tr key={product.id} className="border-t border-racing/5 align-middle">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-racing">{product.code}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {image ? (
                            <button
                              type="button"
                              onClick={() => setImagePreview({ ...image, alt: product.name })}
                              className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-racing/10 bg-cream-dark"
                              aria-label={`View photo for ${product.name}`}
                            >
                              <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            </button>
                          ) : (
                            <NoImageIcon />
                          )}
                          <div className="min-w-[92px]">
                            <label className="inline-flex cursor-pointer rounded-md border border-racing/20 px-2 py-1 text-[11px] font-semibold text-racing hover:bg-cream-dark">
                              {image ? "Change" : "Upload"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                  void uploadMiniProductImage(product.id, event.target.files?.[0] || null);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>
                            {image && (
                              <button
                                type="button"
                                onClick={() => void removeMiniProductImage(product.id)}
                                className="ml-2 text-[11px] font-semibold text-red-700 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                            {action && (
                              <div className={`mt-1 max-w-[180px] truncate text-[11px] ${
                                action.tone === "error" ? "text-red-700" : action.tone === "success" ? "text-green-800" : "text-ink-muted"
                              }`}>
                                {action.text}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-racing">{product.name}</div>
                        {product.fits && <div className="text-xs text-ink-muted">{product.fits}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">{sectionLabel(product.section)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${product.active === false ? "bg-cream-dark text-ink-muted" : "bg-green-50 text-green-800"}`}>
                          {product.active === false ? "Hidden" : "Active"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceExVat)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceIncVat)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => editManualProduct(product)} className="text-sm font-semibold text-racing hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => void deleteManualProduct(product.id)} className="ml-4 text-sm font-semibold text-red-700 hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : catalogue === "mini" ? (
            <table className="w-full min-w-[980px]">
              <thead className="text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Part no.</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-left">Photo</th>
                  <th className="px-4 py-3 text-right">Ex VAT</th>
                  <th className="px-4 py-3 text-right">Inc VAT</th>
                </tr>
              </thead>
              <tbody>
                {miniRows.slice(0, limit).map((product) => {
                  const image = miniProductImages[product.id];
                  const action = imageAction?.productId === product.id ? imageAction : null;
                  return (
                    <tr key={product.id} className="border-t border-racing/5 align-middle">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-racing">{product.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-racing">{product.name}</div>
                        <div className="text-xs text-ink-muted">{product.fits}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">{product.section}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {image ? (
                            <button
                              type="button"
                              onClick={() => setImagePreview({ ...image, alt: product.name })}
                              className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-racing/10 bg-cream-dark"
                              aria-label={`View photo for ${product.name}`}
                            >
                              <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                            </button>
                          ) : (
                            <NoImageIcon />
                          )}
                          <div className="min-w-[92px]">
                            <label className="inline-flex cursor-pointer rounded-md border border-racing/20 px-2 py-1 text-[11px] font-semibold text-racing hover:bg-cream-dark">
                              {image ? "Change" : "Upload"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                  void uploadMiniProductImage(product.id, event.target.files?.[0] || null);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>
                            {image && (
                              <button
                                type="button"
                                onClick={() => void removeMiniProductImage(product.id)}
                                className="ml-2 text-[11px] font-semibold text-red-700 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                            {action && (
                              <div className={`mt-1 max-w-[180px] truncate text-[11px] ${
                                action.tone === "error" ? "text-red-700" : action.tone === "success" ? "text-green-800" : "text-ink-muted"
                              }`}>
                                {action.text}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceExVat)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-racing">{money(product.priceIncVat)}</td>
                    </tr>
                  );
                })}
              </tbody>
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

      {imagePreview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-racing/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={imagePreview.alt}
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute right-3 top-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-racing shadow hover:bg-cream"
            >
              Close
            </button>
            <img
              src={imagePreview.url}
              alt={imagePreview.alt}
              className="max-h-[86vh] w-auto max-w-full rounded-lg bg-white object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function money(value: number | null | undefined) {
  return typeof value === "number" ? `\u00a3${value.toFixed(2)}` : "POA";
}

function sectionLabel(code: string) {
  if (code === MANUAL_MINI_SECTION_CODE) return "Other";
  const section = sections.find((item) => item.code === code);
  return section ? `${section.code} - ${section.label}` : code;
}

function NoImageIcon() {
  return (
    <div
      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-racing/20 bg-cream-dark/70 text-racing/60"
      title="No image yet"
      aria-label="No image yet"
    >
      <span className="relative block h-4 w-5 rounded-[3px] border border-current before:absolute before:-top-1 before:left-1 before:h-1 before:w-2 before:rounded-sm before:border before:border-current before:content-[''] after:absolute after:left-1/2 after:top-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-current after:content-['']" />
      <span className="mt-1 text-[8px] font-bold uppercase leading-none">No image</span>
    </div>
  );
}
