"use client";

import { useEffect, useMemo, useState } from "react";
import { products, sections } from "@/lib/mini-data";
import { metalCategories, metals } from "@/lib/metals-data";

type Catalogue = "mini" | "metals";

type MiniProductImage = {
  productId: string;
  url: string;
  uploadedAt: string;
};

type ProductPreviewImage = MiniProductImage & {
  alt: string;
};

type ImageAction = {
  productId: string;
  text: string;
  tone: "loading" | "success" | "error";
} | null;

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

  const rows = catalogue === "mini" ? miniRows : metalRows;
  const total = catalogue === "mini" ? products.length : metals.length;

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
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-racing/15 bg-cream-dark/60 text-[10px] font-semibold text-ink-muted">
                              None
                            </div>
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
