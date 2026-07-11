"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const COMMON_UPLOAD_TYPES = ["CAD", "PDF", "Images", "Sketches", "Drawings", "ZIP"];

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

const finishOptions = [
  "Raw / as cut",
  "Deburred edges",
  "Powder coated",
  "Anodised",
  "Plated",
  "Brushed or polished",
  "Not sure yet",
];

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validate(files: File[]) {
  if (files.length > MAX_FILES) return `Upload up to ${MAX_FILES} files at a time.`;
  const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
  if (oversized) return `${oversized.name} is larger than the 2 GB per-file limit.`;
  return "";
}

type CompletedUpload = {
  token: string;
  name: string;
  size: number;
};

async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The file upload could not be completed.");
  return data;
}

async function uploadPart(token: string, partNumber: number, chunk: Blob) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `/api/quote-uploads?token=${encodeURIComponent(token)}&partNumber=${partNumber}`,
        { method: "PUT", body: chunk }
      );
      return await jsonResponse<{ partNumber: number; etag: string }>(response);
    } catch (error) {
      lastError = error as Error;
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError || new Error("The file upload could not be completed.");
}

async function uploadLargeFile(file: File, onProgress: (percent: number) => void): Promise<CompletedUpload> {
  const startResponse = await fetch("/api/quote-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", name: file.name, size: file.size, type: file.type }),
  });
  const start = await jsonResponse<{ token: string }>(startResponse);
  const parts: { partNumber: number; etag: string }[] = [];

  try {
    let partNumber = 1;
    for (let offset = 0; offset < file.size; offset += UPLOAD_CHUNK_BYTES) {
      const end = Math.min(file.size, offset + UPLOAD_CHUNK_BYTES);
      parts.push(await uploadPart(start.token, partNumber, file.slice(offset, end)));
      onProgress(Math.round((end / file.size) * 100));
      partNumber += 1;
    }

    const completeResponse = await fetch("/api/quote-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", token: start.token, parts }),
    });
    const complete = await jsonResponse<{ file: CompletedUpload }>(completeResponse);
    return complete.file;
  } catch (error) {
    void fetch("/api/quote-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "abort", token: start.token }),
    });
    throw error;
  }
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
  return next;
}

function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export default function CustomEngineeringForm() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const warningDialogRef = useRef<HTMLDivElement | null>(null);
  const warningReturnFocusRef = useRef<HTMLElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [completedUploads, setCompletedUploads] = useState<Record<string, CompletedUpload>>({});
  const [dragging, setDragging] = useState(false);
  const [drawingStatus, setDrawingStatus] = useState<"cad" | "help">("cad");
  const [arrangeOwnDelivery, setArrangeOwnDelivery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ file: string; index: number; total: number; percent: number } | null>(null);
  const [showNoFileWarning, setShowNoFileWarning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ quoteId: string } | null>(null);

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files]
  );

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => {
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    if (!showNoFileWarning || !warningDialogRef.current) return;
    const dialog = warningDialogRef.current;
    warningReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const selector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(selector));
    window.setTimeout(() => controls()[0]?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowNoFileWarning(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = controls();
      if (items.length === 0) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      warningReturnFocusRef.current?.focus();
    };
  }, [showNoFileWarning]);

  function addFiles(incoming: File[]) {
    const next = mergeFiles(files, incoming);
    const validation = validate(next);
    if (validation) {
      setError(validation);
      return;
    }
    setFiles(next);
    if (next.length > 0) setShowNoFileWarning(false);
    setError("");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  }

  async function sendRequest(formElement: HTMLFormElement) {
    const validation = validate(files);
    if (validation) {
      setError(validation);
      return;
    }

    const form = new FormData(formElement);

    setSubmitting(true);
    try {
      const uploadedFiles: CompletedUpload[] = [];
      const uploadCache = { ...completedUploads };
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const fingerprint = fileFingerprint(file);
        let completed = uploadCache[fingerprint];
        if (!completed) {
          setUploadProgress({ file: file.name, index: index + 1, total: files.length, percent: 0 });
          completed = await uploadLargeFile(file, (percent) =>
            setUploadProgress({ file: file.name, index: index + 1, total: files.length, percent })
          );
          uploadCache[fingerprint] = completed;
          setCompletedUploads({ ...uploadCache });
        }
        uploadedFiles.push(completed);
      }

      const res = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "custom",
          website: form.get("website"),
          customer: {
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
            company: form.get("company"),
            address: form.get("address"),
            arrangeOwnDelivery,
            message: form.get("message"),
          },
          custom: {
            projectName: form.get("projectName"),
            material: form.get("material"),
            thickness: form.get("thickness"),
            finish: form.get("finish"),
            quantity: form.get("quantity"),
            units: form.get("units"),
            tolerance: form.get("tolerance"),
            deadline: form.get("deadline"),
            budget: form.get("budget"),
            drawingStatus,
          },
          uploadedFiles,
        }),
      });
      const data = await res.json() as { error?: string; code?: string; quoteId?: string };
      if (!res.ok) {
        if (data.code === "UPLOAD_TOKEN_INVALID") setCompletedUploads({});
        throw new Error(data.error || "Request could not be sent.");
      }

      formElement.reset();
      setFiles([]);
      setCompletedUploads({});
      setDrawingStatus("cad");
      setArrangeOwnDelivery(false);
      if (!data.quoteId) throw new Error("The request was saved without a reference. Please contact M-Machine.");
      setSuccess({ quoteId: data.quoteId });
    } catch (err) {
      setError((err as Error).message || "Request could not be sent.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;

    if (submitting) return;

    if (files.length === 0) {
      setShowNoFileWarning(true);
      return;
    }

    void sendRequest(formElement);
  }

  function uploadNow() {
    setShowNoFileWarning(false);
    setTimeout(() => inputRef.current?.click(), 0);
  }

  function continueWithoutFiles() {
    const formElement = formRef.current;
    if (!formElement) return;
    if (!formElement.reportValidity()) {
      setShowNoFileWarning(false);
      return;
    }
    setShowNoFileWarning(false);
    void sendRequest(formElement);
  }

  if (success) {
    return (
      <div ref={successRef} className="scroll-mt-28 rounded-2xl border border-racing/10 bg-white p-6 shadow-sm">
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
    <>
    <form ref={formRef} onSubmit={submit} className="rounded-2xl border border-racing/10 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[2px] text-gold">Start a custom quote</p>
        <h2 className="mt-2 font-display text-3xl text-racing">Upload your design</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Add CAD, photos, PDFs, drawings, ZIP files or anything else that helps us understand the job.
          Files are optional if you can describe what you need clearly.
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
          className="sr-only"
          onChange={(event) => addFiles(Array.from(event.target.files || []))}
        />
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="custom-website">Website</label>
          <input id="custom-website" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        </div>
        <div className="mx-auto mb-4 flex flex-wrap justify-center gap-2">
          {COMMON_UPLOAD_TYPES.map((type) => (
            <span key={type} className="rounded-md bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-racing shadow-sm">
              {type}
            </span>
          ))}
        </div>
        <p className="font-semibold text-racing">Drop files here</p>
        <p className="mt-1 text-sm text-ink-muted">
          CAD, photos, PDFs, spreadsheets, ZIP files or sketches. Up to {MAX_FILES} files, 2 GB each.
        </p>
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
          <input id="name" name="name" required autoComplete="name" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="company">Company</label>
          <input id="company" name="company" autoComplete="organization" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone *</label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" className="input" />
        </div>
      </div>

      <div className="mt-5">
        {!arrangeOwnDelivery && (
          <>
          <label className="label" htmlFor="address">Delivery address</label>
          <textarea
            id="address"
            name="address"
            rows={4}
            required
            className="input resize-none"
            autoComplete="street-address"
            placeholder="Full delivery address, including postcode"
          />
          </>
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

      {uploadProgress && (
        <div className="mt-5 rounded-xl border border-racing/10 bg-cream-dark p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm text-racing">
            <span className="truncate">Uploading {uploadProgress.index} of {uploadProgress.total}: {uploadProgress.file}</span>
            <strong>{uploadProgress.percent}%</strong>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-gold transition-[width]" style={{ width: `${uploadProgress.percent}%` }} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-ink-muted">
          Uploads are optional, but useful photos, drawings or files help us quote accurately.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? (uploadProgress ? "Uploading files..." : "Submitting...") : "Submit custom request"}
        </button>
      </div>
    </form>
    {showNoFileWarning && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-racing/55 px-4 py-6 backdrop-blur-sm">
        <div
          ref={warningDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-file-title"
          className="w-full max-w-md rounded-2xl border border-racing/10 bg-white p-6 shadow-2xl"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-dark text-racing">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h2 id="no-file-title" className="font-display text-2xl text-racing">
            You haven&apos;t uploaded any files
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            A drawing, photo or CAD file usually helps us quote more accurately. You can add one now,
            or continue if your written details explain the job clearly.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={uploadNow} className="btn-primary justify-center" disabled={submitting}>
              Upload now
            </button>
            <button type="button" onClick={continueWithoutFiles} className="btn-secondary justify-center" disabled={submitting}>
              Continue anyway
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
