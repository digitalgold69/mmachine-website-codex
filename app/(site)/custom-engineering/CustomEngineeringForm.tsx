"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const COMMON_UPLOAD_TYPES = ["CAD", "PDF", "Images", "Sketches", "Drawings", "ZIP"];

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

function requestTitle(message: FormDataEntryValue | null) {
  const firstLine = String(message || "").trim().split(/\r?\n/, 1)[0];
  if (!firstLine) return "Custom work request";
  return firstLine.length > 100 ? `${firstLine.slice(0, 97)}...` : firstLine;
}

export default function CustomEngineeringForm() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const warningDialogRef = useRef<HTMLDivElement | null>(null);
  const warningReturnFocusRef = useRef<HTMLElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [completedUploads, setCompletedUploads] = useState<Record<string, CompletedUpload>>({});
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [noFileConfirmed, setNoFileConfirmed] = useState(false);
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
    if (next.length > 0) {
      setShowNoFileWarning(false);
      setNoFileConfirmed(false);
    }
    setError("");
  }

  function removeFile(fileToRemove: File) {
    const next = files.filter((file) => file !== fileToRemove);
    setFiles(next);
    if (next.length === 0) setNoFileConfirmed(false);
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
            address: deliveryRequired ? form.get("address") : "",
            arrangeOwnDelivery: !deliveryRequired,
            message: form.get("message"),
          },
          custom: {
            projectName: requestTitle(form.get("message")),
            material: "",
            thickness: "",
            finish: "",
            quantity: "",
            units: "",
            tolerance: "",
            deadline: "",
            budget: "",
            drawingStatus: files.length > 0 ? "cad" : "help",
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
      setStep(1);
      setDeliveryRequired(false);
      setNoFileConfirmed(false);
      if (!data.quoteId) throw new Error("The request was saved without a reference. Please contact M-Machine.");
      setSuccess({ quoteId: data.quoteId });
    } catch (err) {
      setError((err as Error).message || "Request could not be sent.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  function showStep(nextStep: 1 | 2) {
    setStep(nextStep);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function continueToContactDetails() {
    setError("");
    if (!messageRef.current?.reportValidity()) return;
    if (files.length === 0 && !noFileConfirmed) {
      setShowNoFileWarning(true);
      return;
    }
    showStep(2);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (submitting) return;
    void sendRequest(event.currentTarget);
  }

  function uploadNow() {
    setShowNoFileWarning(false);
    setTimeout(() => inputRef.current?.click(), 0);
  }

  function continueWithoutFiles() {
    setNoFileConfirmed(true);
    setShowNoFileWarning(false);
    showStep(2);
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
            View Featured Work
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
    <form
      ref={formRef}
      onSubmit={submit}
      className="scroll-mt-28 rounded-2xl border border-racing/10 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="custom-website">Website</label>
        <input id="custom-website" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>

      <ol className="mb-7 grid grid-cols-2 overflow-hidden rounded-xl border border-racing/10" aria-label="Quote request steps">
        {[
          { number: 1, label: "Job details" },
          { number: 2, label: "Your details" },
        ].map((item) => {
          const active = step === item.number;
          const complete = step > item.number;
          return (
            <li
              key={item.number}
              aria-current={active ? "step" : undefined}
              className={`flex min-h-16 items-center gap-3 px-4 py-3 ${
                active ? "bg-racing text-cream" : "bg-cream text-racing"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active ? "bg-gold text-cream" : complete ? "bg-racing text-cream" : "bg-white"
                }`}
              >
                {complete ? "OK" : item.number}
              </span>
              <span className="text-sm font-semibold">{item.label}</span>
            </li>
          );
        })}
      </ol>

      <section className={step === 1 ? "block" : "hidden"} aria-hidden={step !== 1}>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-gold">Step 1 of 2</p>
          <h2 className="mt-2 font-display text-3xl text-racing">Tell us about the job</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Add any useful files, then describe what you need made in one clear box.
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
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-gold mt-4">
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
                    onClick={() => removeFile(file)}
                    className="shrink-0 text-xs font-semibold text-racing underline hover:text-gold"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="message">Job details *</label>
          <textarea
            ref={messageRef}
            id="message"
            name="message"
            required
            rows={7}
            className="input resize-y"
            placeholder="Describe the part, quantity, material if known, important dimensions and what it needs to do."
          />
        </div>
      </section>

      <section className={step === 2 ? "block" : "hidden"} aria-hidden={step !== 2}>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-gold">Step 2 of 2</p>
          <h2 className="mt-2 font-display text-3xl text-racing">Where should we send the quote?</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            We only use these details to prepare the quote and contact you about this job.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name *</label>
            <input id="name" name="name" required={step === 2} autoComplete="name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="company">Company</label>
            <input id="company" name="company" autoComplete="organization" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email *</label>
            <input id="email" name="email" type="email" required={step === 2} autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone *</label>
            <input id="phone" name="phone" type="tel" required={step === 2} autoComplete="tel" className="input" />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-racing/10 bg-cream-dark p-4">
          <div className="font-semibold text-racing">Collection from M-Machine</div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Collection is selected by default, so no address is needed.
          </p>
          <label className="mt-4 flex items-start gap-3 rounded-lg bg-white p-3 text-sm text-racing">
            <input
              type="checkbox"
              checked={deliveryRequired}
              onChange={(event) => setDeliveryRequired(event.target.checked)}
              className="mt-1"
            />
            <span>
              I need delivery
              <span className="block text-xs text-ink-muted">
                Add your address so carriage can be included in the quote.
              </span>
            </span>
          </label>
        </div>

        {deliveryRequired && (
          <div className="mt-4">
            <label className="label" htmlFor="address">Delivery address *</label>
            <textarea
              id="address"
              name="address"
              rows={4}
              required
              className="input resize-y"
              autoComplete="street-address"
              placeholder="Full delivery address, including postcode"
            />
          </div>
        )}
      </section>

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

      {step === 1 ? (
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-ink-muted">
            Files are optional when the written details explain the job clearly.
          </p>
          <button type="button" onClick={continueToContactDetails} className="btn-primary justify-center">
            Continue to your details
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => showStep(1)} className="btn-secondary justify-center" disabled={submitting}>
            Back to job details
          </button>
          <button type="submit" disabled={submitting} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? (uploadProgress ? "Uploading files..." : "Submitting...") : "Submit custom request"}
          </button>
        </div>
      )}
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
