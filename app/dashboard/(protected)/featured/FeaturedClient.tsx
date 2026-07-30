"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

// Server-side type — kept in sync with /api/featured/route.ts
type Entry = {
  id: string;
  title: string;
  description: string;
  tag: string;
  year: number;
  category: string;
  fullStory: string;
  image: string;
  priceExVat: number | null;
};

// What the EditForm operates on. `imageFile` is what the user picked from
// disk this session; `imageDataUrl` is the inline preview we send to the
// server. Either may be empty (= keep existing image).
type Draft = Entry & {
  imageDataUrl?: string;
};

const PAGE_SIZE = 20;

function imageSrc(image: string): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://") || image.startsWith("/")) {
    return image;
  }
  return `/featured/${image}`;
}

export default function FeaturedClient({ initialEntries }: { initialEntries: Entry[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Entry[]>(initialEntries);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const [preview, setPreview] = useState<Entry | null>(null);
  const [page, setPage] = useState(1);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleItems = items.slice(pageStart, pageStart + PAGE_SIZE);
  const showingFrom = items.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(items.length, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!preview) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    window.setTimeout(() => {
      previewRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreview(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [preview]);

  // Show a banner that fades after a few seconds
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(t);
  }, [flash]);

  function startAdd() {
    setEditing({
      id: "",
      title: "",
      description: "",
      tag: "Bespoke",
      year: new Date().getFullYear(),
      category: "Fabrication",
      fullStory: "",
      image: "",
      priceExVat: null,
    });
  }

  function startEdit(it: Entry) {
    setEditing({ ...it });
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, job: Entry) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setPreview(job);
  }

  async function handleSignOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/dashboard/login");
  }

  async function handleSave(draft: Draft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: {
            id: draft.id,
            title: draft.title,
            description: draft.description,
            tag: draft.tag,
            category: draft.category,
            fullStory: draft.fullStory,
            image: draft.image,
            priceExVat: draft.priceExVat,
          },
          imageDataUrl: draft.imageDataUrl,
        }),
      });
      const data = await res.json() as { error?: string; entry?: Entry };
      if (!res.ok) throw new Error(data.error || "Save failed");

      if (!data.entry) throw new Error("Save completed without returning the entry.");
      const saved: Entry = data.entry;
      setItems((prev) => {
        const i = prev.findIndex((x) => x.id === saved.id);
        if (i >= 0) {
          const copy = [...prev];
          copy[i] = saved;
          return copy;
        }
        return [saved, ...prev];
      });
      setPage(1);
      setEditing(null);
      setFlash(`Saved "${saved.title}". The public site updates within a minute.`);
    } catch (e) {
      setError((e as Error).message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const it = pendingDelete;
    if (!it) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/featured", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      setPendingDelete(null);
      setFlash(`Deleted "${it.title}".`);
    } catch (e) {
      setError((e as Error).message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <EditForm
        initial={editing}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setError(null); }}
        busy={busy}
        error={error}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-racing">Featured Work</h1>
          <p className="text-ink-muted text-sm">{items.length} showcase {items.length === 1 ? "job" : "jobs"} on the public site</p>
        </div>
        <div className="flex gap-2">
          <button onClick={startAdd} className="btn-primary">+ Add new job</button>
          <button onClick={handleSignOut} className="btn-secondary text-sm">Sign out</button>
        </div>
      </div>

      {flash && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 text-sm mb-5">
          {flash}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-5">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
          <span>
            Showing {showingFrom}-{showingTo} of {items.length}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-racing/20 px-3 py-2 font-medium text-racing disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="min-w-16 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                disabled={currentPage === pageCount}
                className="rounded-lg border border-racing/20 px-3 py-2 font-medium text-racing disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((job) => (
          <article
            key={job.id}
            role="button"
            tabIndex={0}
            onClick={() => setPreview(job)}
            onKeyDown={(event) => handleCardKeyDown(event, job)}
            aria-label={`Preview ${job.title}`}
            className="card flex min-h-full cursor-pointer flex-col bg-white transition hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
          >
            <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-4 overflow-hidden flex items-center justify-center p-2">
              {job.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc(job.image) || ""} alt={job.title} className="max-h-full max-w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="#DF1718" strokeWidth="1.5">
                  <path d="M10 40 L30 15 L50 40 Z" />
                  <circle cx="30" cy="32" r="3" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="chip !bg-racing !text-cream !text-[10px]">{job.tag.toUpperCase()}</span>
              <span className="min-w-0 truncate text-xs text-ink-muted">{job.category}</span>
            </div>
            <h3 className="font-display text-lg text-racing mb-2">{job.title}</h3>
            <p className="text-sm text-ink-muted mb-4 line-clamp-2">{job.description}</p>
            <p className="mb-4 text-sm font-semibold text-racing">
              {typeof job.priceExVat === "number" ? `£${job.priceExVat.toFixed(2)} ex VAT` : "POA"}
            </p>
            <div className="mt-auto flex gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <button onClick={() => startEdit(job)} className="btn-secondary text-xs py-1 px-3" disabled={busy}>Edit</button>
              <button type="button" onClick={() => setPendingDelete(job)} className="text-xs text-red-700 hover:underline ml-auto" disabled={busy}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-racing/10 p-12 text-center">
          <p className="text-ink-muted mb-4">No featured items yet. Add one to showcase what M-Machine can make.</p>
          <button onClick={startAdd} className="btn-primary">Add your first job</button>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-racing-dark/55 px-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-featured-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="delete-featured-title" className="font-display text-2xl text-racing">Delete this featured job?</h2>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              &ldquo;{pendingDelete.title}&rdquo; will be removed from the public website. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPendingDelete(null)} disabled={busy} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={busy} className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                {busy ? "Deleting..." : "Delete job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-racing-dark/65 px-3 py-5 backdrop-blur-sm sm:px-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <div
            ref={previewRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="featured-preview-title"
            className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-racing/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="chip !bg-racing !text-cream">{preview.tag.toUpperCase()}</span>
                  <span className="text-xs text-ink-muted">{preview.category}</span>
                </div>
                <h2 id="featured-preview-title" className="font-display text-2xl leading-tight text-racing sm:text-3xl">
                  {preview.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="shrink-0 rounded-lg border border-racing/20 px-3 py-2 text-sm font-semibold text-racing hover:bg-cream-dark"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                <div className="flex min-h-[280px] items-center justify-center rounded-lg bg-cream-dark p-3 sm:min-h-[460px]">
                  {preview.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc(preview.image) || ""}
                      alt={preview.title}
                      className="max-h-[68vh] max-w-full object-contain"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <svg width="96" height="96" viewBox="0 0 60 60" fill="none" stroke="#DF1718" strokeWidth="1.5" aria-hidden="true">
                      <path d="M10 40 L30 15 L50 40 Z" />
                      <circle cx="30" cy="32" r="3" />
                    </svg>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-sm leading-7 text-ink-muted">{preview.description}</p>
                  {preview.fullStory?.trim() && (
                    <div className="rounded-lg bg-cream-dark p-4 text-sm leading-7 text-ink">
                      {preview.fullStory}
                    </div>
                  )}
                  <div className="rounded-lg border border-racing/10 p-4">
                    <div className="text-xs uppercase tracking-wider text-ink-muted">Price ex VAT</div>
                    <div className="font-display text-2xl text-racing">
                      {typeof preview.priceExVat === "number" ? `\u00a3${preview.priceExVat.toFixed(2)}` : "POA"}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 border-t border-racing/10 pt-4">
                    <button type="button" onClick={() => { setPreview(null); startEdit(preview); }} disabled={busy} className="btn-secondary">
                      Edit
                    </button>
                    <button type="button" onClick={() => { setPreview(null); setPendingDelete(preview); }} disabled={busy} className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit form ──────────────────────────────────────────────────────────

function EditForm({
  initial,
  onSave,
  onCancel,
  busy,
  error,
}: {
  initial: Draft;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<Draft>(initial);
  const [imagePreview, setImagePreview] = useState<string | null>(
    imageSrc(initial.image)
  );
  const [imageError, setImageError] = useState("");
  const isNew = !initial.id;

  function handleImageChange(file: File | null) {
    if (!file) {
      setForm({ ...form, imageDataUrl: undefined });
      setImageError("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("That photo is over 5 MB. Please choose a smaller one.");
      return;
    }
    setImageError("");
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImagePreview(url);
      setForm({ ...form, imageDataUrl: url });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <button onClick={onCancel} className="text-sm text-ink-muted hover:text-racing mb-3" disabled={busy}>
        ← Back to Featured Work
      </button>
      <h1 className="font-display text-3xl text-racing mb-6">{isNew ? "Add new featured job" : "Edit featured job"}</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-5 max-w-3xl">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="bg-white rounded-xl border border-racing/10 p-6 max-w-3xl"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Job title *</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="e.g. Aluminium bonnet scoop"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Tag</label>
            <select
              className="input"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
            >
              <option>Bespoke</option>
              <option>Fabrication</option>
              <option>Restoration</option>
              <option>One-off</option>
              <option>Racing</option>
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="label">Category</label>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Fabrication, Engineering, Welding"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="featured-price">Price ex VAT (optional)</label>
            <div className="relative max-w-xs">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-muted">£</span>
              <input
                id="featured-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="input pl-8"
                value={form.priceExVat ?? ""}
                onChange={(e) => setForm({
                  ...form,
                  priceExVat: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                })}
                placeholder="Leave blank for POA"
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Leave this blank when the item needs to be quoted individually.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Short description *</label>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              placeholder="One or two sentences that describe the job."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Full story</label>
            <textarea
              className="input"
              rows={6}
              value={form.fullStory}
              onChange={(e) => setForm({ ...form, fullStory: e.target.value })}
              placeholder="The detailed story — what the brief was, how you made it, any technical notes."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Photo</label>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="w-32 h-24 bg-cream-dark rounded-lg flex items-center justify-center overflow-hidden p-1">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="" className="max-h-full max-w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DF1718" strokeWidth="1.5">
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <circle cx="8.5" cy="10.5" r="1.5" />
                    <path d="M21 16l-5-5L5 19" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                <p className="text-xs text-ink-muted mt-2">JPG, PNG, WebP, or GIF. Max 5 MB. Square or landscape works best.</p>
                {imageError && <p role="alert" className="mt-2 text-sm text-red-700">{imageError}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-racing/10">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
