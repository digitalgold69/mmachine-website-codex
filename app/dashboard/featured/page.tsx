"use client";

import { useState } from "react";
import Link from "next/link";
import { featuredWork as initial } from "@/lib/featured-data";
import type { FeaturedWork } from "@/lib/featured-data";

export default function FeaturedDashboardPage() {
  const [items, setItems] = useState<FeaturedWork[]>(initial);
  const [editing, setEditing] = useState<FeaturedWork | null>(null);

  const handleAdd = () => {
    setEditing({
      id: `new-${Date.now()}`,
      title: "",
      description: "",
      tag: "Bespoke",
      year: new Date().getFullYear(),
      category: "Fabrication",
      fullStory: "",
    });
  };

  const handleSave = (updated: FeaturedWork) => {
    const existing = items.find((i) => i.id === updated.id);
    if (existing) setItems(items.map((i) => (i.id === updated.id ? updated : i)));
    else setItems([updated, ...items]);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this featured job?")) {
      setItems(items.filter((i) => i.id !== id));
    }
  };

  if (editing) {
    return <EditForm item={editing} onSave={handleSave} onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-racing">Featured workshop jobs</h1>
          <p className="text-ink-muted text-sm">{items.length} showcase {items.length === 1 ? "job" : "jobs"}</p>
        </div>
        <button onClick={handleAdd} className="btn-primary">+ Add new job</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((job) => (
          <div key={job.id} className="card bg-white">
            <div className="aspect-video bg-cream-dark rounded-lg mb-4 flex items-center justify-center">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="#B8860B" strokeWidth="1.5">
                <path d="M10 40 L30 15 L50 40 Z" />
                <circle cx="30" cy="32" r="3" />
              </svg>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="chip !bg-racing !text-cream !text-[10px]">{job.tag.toUpperCase()}</span>
              <span className="text-xs text-ink-muted">{job.year}</span>
            </div>
            <h3 className="font-display text-lg text-racing mb-2">{job.title}</h3>
            <p className="text-sm text-ink-muted mb-4 line-clamp-2">{job.description}</p>
            <div className="flex gap-2">
              <button onClick={() => setEditing(job)} className="btn-secondary text-xs py-1 px-3">Edit</button>
              <button onClick={() => handleDelete(job.id)} className="text-xs text-red-700 hover:underline ml-auto">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-racing/10 p-12 text-center">
          <p className="text-ink-muted mb-4">No featured jobs yet. Add one to showcase your workshop&apos;s capability.</p>
          <button onClick={handleAdd} className="btn-primary">Add your first job</button>
        </div>
      )}
    </div>
  );
}

function EditForm({ item, onSave, onCancel }: { item: FeaturedWork; onSave: (i: FeaturedWork) => void; onCancel: () => void }) {
  const [form, setForm] = useState(item);
  const isNew = item.id.startsWith("new-");

  return (
    <div>
      <button onClick={onCancel} className="text-sm text-ink-muted hover:text-racing mb-3">← Back to featured work</button>
      <h1 className="font-display text-3xl text-racing mb-6">{isNew ? "Add new featured job" : "Edit featured job"}</h1>

      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="bg-white rounded-xl border border-racing/10 p-6 max-w-3xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Job title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Aluminium bonnet scoop" />
          </div>
          <div>
            <label className="label">Tag</label>
            <select className="input" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
              <option>Bespoke</option>
              <option>Fabrication</option>
              <option>Restoration</option>
              <option>One-off</option>
              <option>Racing</option>
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Fabrication, Engineering, Welding" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Short description *</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="One or two sentences that describe the job." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Full story</label>
            <textarea className="input" rows={6} value={form.fullStory} onChange={(e) => setForm({ ...form, fullStory: e.target.value })} placeholder="The detailed story — what the brief was, how you made it, any technical notes." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Photo</label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 bg-cream-dark rounded-lg flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="1" /><circle cx="8.5" cy="10.5" r="1.5" /><path d="M21 16l-5-5L5 19" /></svg>
              </div>
              <button type="button" className="btn-secondary text-sm">Upload photo</button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-racing/10">
          <button type="submit" className="btn-primary">Save</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
