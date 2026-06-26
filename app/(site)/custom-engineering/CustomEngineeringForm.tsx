"use client";

import { DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";

const ACCEPTED_EXTENSIONS = ["dxf", "dwg", "ai", "eps", "step", "stp"];
const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

const materials = [
  "Aluminium",
  "Aluminium Bronze/Manganese Bronze",
  "Brass",
  "Cast Iron",
  "Copper",
  "Gauge Plate",
  "Nickel Silver",
  "Phosphor Bronze",
  "Leaded Gunmetal",
  "Plastics",
  "Stainless Steel",
  "Steel",
  "Silver steel",
  "Steel Tube",
];

const services = [
  "Laser/profile cutting",
  "Waterjet cutting",
  "CNC routing",
  "Folding/bending",
  "Tapping/threading",
  "Countersinking/counterboring",
  "Hardware insertion",
  "Welding/assembly",
  "Powder coating",
  "Anodising/plating",
  "Deburring/edge finishing",
];

const finishOptions = [
  "Raw / as cut",
  "Deburred edges",
  "Powder coated",
  "Anodised",
  "Plated",
  "Brushed or polished",
  "Not sure yet",
];

function cleanExtension(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validate(files: File[]) {
  if (files.length > MAX_FILES) return `Upload up to ${MAX_FILES} files at a time.`;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) return "The combined upload is too large. Please keep it below 60 MB.";

  const invalid = files.find((file) => !ACCEPTED_EXTENSIONS.includes(cleanExtension(file.name)));
  if (invalid) return `${invalid.name} is not an accepted file type.`;

  const tooLarge = files.find((file) => file.size > MAX_FILE_BYTES);
  if (tooLarge) return `${tooLarge.name} is too large. Maximum file size is 15 MB.`;

  return "";
}

function mergeFiles(current: File[], incoming: File[]) {
  const next = [...current];
  for (const file of incoming) {
    const duplicate = next.some(
      (existing) =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
    );
    if (!duplicate) next.push(file);
  }
  return next.slice(0, MAX_FILES);
}

export default function CustomEngineeringForm() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [drawingStatus, setDrawingStatus] = useState<"cad" | "help">("cad");
  const [arrangeOwnDelivery, setArrangeOwnDelivery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ quoteId: string } | null>(null);

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files]
  );

  function addFiles(incoming: File[]) {
    const next = mergeFiles(files, incoming);
    const validation = validate(next);
    if (validation) {
      setError(validation);
      return;
    }
    setFiles(next);
    setError("");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (drawingStatus === "cad" && files.length === 0) {
      setError("Please upload a CAD file, or choose the option that you need help from a sketch or description.");
      return;
    }

    const validation = validate(files);
    if (validation) {
      setError(validation);
      return;
    }

    const form = new FormData(event.currentTarget);
    files.forEach((file) => form.append("files", file));
    form.set("drawingStatus", drawingStatus);
    form.set("arrangeOwnDelivery", arrangeOwnDelivery ? "true" : "false");

    setSubmitting(true);
    try {
      const res = await fetch("/api/quote-requests", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request could not be sent.");

      event.currentTarget.reset();
      setFiles([]);
      setDrawingStatus("cad");
      setArrangeOwnDelivery(false);
      setSuccess({ quoteId: data.quoteId });
    } catch (err) {
      setError((err as Error).message || "Request could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-racing/10 bg-white p-6 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-racing text-sm font-bold text-cream">
          OK
        </div>
        <h2 className="text-center font-display text-3xl text-racing">Thanks for your request</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-ink-muted">
          We will check your drawing or project details, then get in touch with price, timing,
          delivery or collection, and payment details.
        </p>
        <div className="mx-auto mt-5 max-w-sm rounded-lg bg-cream-dark p-3 text-center text-sm text-racing">
          Reference: <strong>{success.quoteId}</strong>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => setSuccess(null)} className="btn-primary justify-center">
            Send another request
          </button>
          <Link href="/featured" className="btn-secondary justify-center">
            View workshop work
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-racing/10 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[2px] text-gold">Start a custom quote</p>
        <h2 className="mt-2 font-display text-3xl text-racing">Upload your design</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Send up to ten drawings and tell us what needs making. If you do not have CAD,
          choose the sketch/help option and describe the part.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mb-5 rounded-xl border-2 border-dashed p-5 text-center transition ${
          dragging ? "border-gold bg-gold/5" : "border-racing/20 bg-cream"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          className="sr-only"
          onChange={(event) => addFiles(Array.from(event.target.files || []))}
        />
        <div className="mx-auto mb-4 flex flex-wrap justify-center gap-2">
          {ACCEPTED_EXTENSIONS.map((ext) => (
            <span key={ext} className="rounded-md bg-white px-3 py-2 font-mono text-xs font-semibold uppercase text-racing shadow-sm">
              .{ext}
            </span>
          ))}
        </div>
        <p className="font-semibold text-racing">Drop CAD files here</p>
        <p className="mt-1 text-sm text-ink-muted">DXF, DWG, AI, EPS, STEP or STP. Max 15 MB each.</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-gold mt-4"
        >
          Browse files
        </button>
      </div>

      {files.length > 0 && (
        <div className="mb-5 rounded-xl border border-racing/10 bg-cream-dark p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
            <span>{files.length} {files.length === 1 ? "file" : "files"} selected</span>
            <span>{fileSize(totalSize)} total</span>
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-racing">{file.name}</div>
                  <div className="text-xs text-ink-muted">{fileSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                  className="shrink-0 text-xs font-semibold text-racing underline hover:text-gold"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <fieldset className="mb-5 grid gap-3 sm:grid-cols-2">
        <legend className="label">Drawing status</legend>
        <label className="rounded-xl border border-racing/10 bg-cream-dark p-3 text-sm text-racing">
          <input
            type="radio"
            name="drawingStatusChoice"
            checked={drawingStatus === "cad"}
            onChange={() => setDrawingStatus("cad")}
            className="mr-2"
          />
          I have CAD files
        </label>
        <label className="rounded-xl border border-racing/10 bg-cream-dark p-3 text-sm text-racing">
          <input
            type="radio"
            name="drawingStatusChoice"
            checked={drawingStatus === "help"}
            onChange={() => setDrawingStatus("help")}
            className="mr-2"
          />
          I need help from a sketch or description
        </label>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="projectName">Project or part name *</label>
          <input id="projectName" name="projectName" required className="input" placeholder="e.g. stainless bracket set, folded aluminium panel" />
        </div>
        <div>
          <label className="label" htmlFor="material">Material</label>
          <select id="material" name="material" className="input" defaultValue="">
            <option value="">Not sure / advise me</option>
            {materials.map((material) => (
              <option key={material} value={material}>{material}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="thickness">Thickness / specification</label>
          <input id="thickness" name="thickness" className="input" placeholder="e.g. 3mm, 6082, 304 stainless" />
        </div>
        <div>
          <label className="label" htmlFor="quantity">Quantity</label>
          <input id="quantity" name="quantity" inputMode="numeric" className="input" placeholder="e.g. 1, 20, 250" />
        </div>
        <div>
          <label className="label" htmlFor="units">Unit</label>
          <input id="units" name="units" className="input" placeholder="e.g. parts, sets, sheets" />
        </div>
        <div>
          <label className="label" htmlFor="finish">Finish</label>
          <select id="finish" name="finish" className="input" defaultValue="">
            <option value="">Not sure / advise me</option>
            {finishOptions.map((finish) => (
              <option key={finish} value={finish}>{finish}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="deadline">Needed by</label>
          <input id="deadline" name="deadline" className="input" placeholder="Date or rough timescale" />
        </div>
        <div>
          <label className="label" htmlFor="tolerance">Tolerance / important dimensions</label>
          <input id="tolerance" name="tolerance" className="input" placeholder="e.g. tight fit on holes, cosmetic face" />
        </div>
        <div>
          <label className="label" htmlFor="budget">Budget guidance</label>
          <input id="budget" name="budget" className="input" placeholder="Optional" />
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="label">Services required</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((service) => (
            <label key={service} className="flex items-start gap-2 rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm text-racing">
              <input type="checkbox" name="services" value={service} className="mt-1" />
              <span>{service}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label className="label" htmlFor="message">Job details *</label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="input resize-none"
          placeholder="Tell us what the part does, any important faces, hole sizes, bends, finishes, delivery needs, or anything not obvious from the file."
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name *</label>
          <input id="name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="company">Company</label>
          <input id="company" name="company" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone *</label>
          <input id="phone" name="phone" required className="input" />
        </div>
      </div>

      <div className="mt-5">
        <label className="label" htmlFor="address">Delivery address</label>
        {!arrangeOwnDelivery && (
          <textarea
            id="address"
            name="address"
            rows={4}
            required
            className="input resize-none"
            placeholder="Full delivery address, including postcode"
          />
        )}
        <label className="mt-3 flex items-start gap-3 rounded-xl border border-racing/10 bg-cream-dark p-3 text-sm text-racing">
          <input
            type="checkbox"
            checked={arrangeOwnDelivery}
            onChange={(event) => setArrangeOwnDelivery(event.target.checked)}
            className="mt-1"
          />
          <span>
            I will arrange delivery / collection
            <span className="block text-xs text-ink-muted">Tick this if you do not need us to quote carriage.</span>
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-ink-muted">
          DXF, DWG, AI, EPS, STEP and STP files are accepted.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Submitting..." : "Submit custom request"}
        </button>
      </div>
    </form>
  );
}
