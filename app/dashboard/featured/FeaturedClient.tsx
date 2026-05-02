"use client";

import { useEffect, useState } from "react";
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
};

// What the EditForm operates on. `imageFile` is what the user picked from
// disk this session; `imageDataUrl` is the inline preview we send to the
// server. Either may be empty (= keep existing image).
type Draft = Entry & {
  imageDataUrl?: string;
};

export default function FeaturedClient({ initialEntries }: { initialEntries: Entry[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Entry[]>(initialEntries);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

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
    });
  }

  function startEdit(it: Entry) {
    setEditing({ ...it });
  }

  async function handleSignOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/dashboard/login");
  }

  async function handleSave(draft: Draft) {
    setBusy(true);
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
            year: draft.year,
            category: draft.category,
            fullStory: draft.fullStory,
            image: draft.image,
          },
          imageDataUrl: draft.imageDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

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
      setEditing(null);
      setFlash(`Saved "${saved.title}". The public site updates within a minute.`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(it: Entry) {
    if (!confirm(`Delete "${it.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/featured", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      setFlash(`Deleted "${it.title}".`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <EditForm
        initial={editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
        busy={busy}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-racing">Featured workshop jobs</h1>
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

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((job) => (
          <div key={job.id} className="card bg-white">
            <div className="aspect-video bg-cream-dark rounded-lg mb-4 overflow-hidden flex items-center justify-center">
              {job.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/featured/${job.id}.${job.image.split(".").pop()}`} alt={job.title} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="#B8860B" strokeWidth="1.5">
                  <path d="M10 40 L30 15 L50 40 Z" />
                  <circle cx="30" cy="32" r="3" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="chip !bg-racing !text-cream !text-[10px]">{job.tag.toUpperCase()}</span>
              <span className="text-xs text-ink-muted">{job.year}</span>
            </div>
            <h3 className="font-display text-lg text-racing mb-2">{job.title}</h3>
            <p className="text-sm text-ink-muted mb-4 line-clamp-2">{job.description}</p>
            <div className="flex gap-2">
              <button onClick={() => startEdit(job)} className="btn-secondary text-xs py-1 px-3" disabled={busy}>Edit</button>
              <button onClick={() => handleDelete(job)} className="text-xs text-red-700 hover:underline ml-auto" disabled={busy}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-racing/10 p-12 text-center">
          <p className="text-ink-muted mb-4">No featured jobs yet. Add one to showcase your workshop&apos;s capability.</p>
          <button onClick={startAdd} className="btn-primary">Add your first job</button>
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
}: {
  initial: Draft;
  onSave: (d: Draft) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<Draft>(initial);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initial.image ? `/featured/${initial.id}.${initial.image.split(".").pop()}` : null
  );
  const isNew = !initial.id;

  function handleImageChange(file: File | null) {
    if (!file) {
      setForm({ ...form, imageDataUrl: undefined });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("That photo is over 5 MB. Please choose a smaller one.");
      return;
    }
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
        ← Back to featured work
      </button>
      <h1 className="font-display text-3xl text-racing mb-6">{isNew ? "Add new featured job" : "Edit featured job"}</h1>

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
          <div>
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
          <div>
            <label className="label">Year</label>
            <input
              type="number"
              className="input"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Category</label>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Fabrication, Engineering, Welding"
            />
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
              <div className="w-32 h-24 bg-cream-dark rounded-lg flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="1.5">
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
