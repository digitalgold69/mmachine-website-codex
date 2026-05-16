"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ContactForm() {
  const searchParams = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const product = searchParams.get("product") || "";
  const sku = searchParams.get("sku") || "";
  const category = searchParams.get("category") || "";
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const defaultMessage = product
    ? `Please can you help with this item?\n\nProduct: ${product}${sku ? `\nPart number / SKU: ${sku}` : ""}${category ? `\nCategory: ${category}` : ""}\nPage: ${pageUrl}`
    : "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData)),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) setSubmitted(true);
    } catch {
      alert("Something went wrong - please call us on 01325 381302.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DF1718" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-racing mb-3">Thanks - message received</h1>
        <p className="text-ink-muted mb-6">
          One of the team will come back to you within one working day. For urgent matters, call 01325 381302.
        </p>
        <Link href="/" className="btn-primary">Back to homepage</Link>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <aside className="md:col-span-1 space-y-6">
        <div>
          <h2 className="font-display text-lg text-racing mb-2">Phone</h2>
          <p className="text-sm text-ink-muted mb-1">Metals &amp; engineering</p>
          <a href="tel:01325381302" className="font-mono text-racing text-lg hover:text-gold">01325 381302</a>
          <p className="text-sm text-ink-muted mt-3 mb-1">Mini pressings &amp; accounts</p>
          <a href="tel:01325381300" className="font-mono text-racing text-lg hover:text-gold">01325 381300</a>
        </div>
        <div>
          <h2 className="font-display text-lg text-racing mb-2">Email</h2>
          <a href="mailto:sales@m-machine.co.uk" className="text-sm text-racing hover:text-gold">sales@m-machine.co.uk</a>
        </div>
        <div>
          <h2 className="font-display text-lg text-racing mb-2">Address</h2>
          <address className="not-italic text-sm text-ink-muted leading-relaxed">
            Unit 3-7 Forge Way<br />
            Cleveland Trading Estate<br />
            Darlington<br />
            County Durham DL1 2PJ
          </address>
        </div>
        <div className="bg-cream-dark rounded-lg p-4 border-l-4 border-gold">
          <p className="text-xs text-ink-muted">
            We do not take payment online. The team confirms availability, carriage and invoice details directly.
          </p>
        </div>
      </aside>

      <form onSubmit={handleSubmit} className="md:col-span-2 bg-white rounded-2xl border border-racing/10 p-6 md:p-8">
        {product && (
          <div className="mb-5 rounded-lg bg-cream-dark p-4 text-sm">
            <div className="font-semibold text-racing">{product}</div>
            <div className="text-ink-muted">
              {[sku, category].filter(Boolean).join(" / ")}
            </div>
          </div>
        )}

        <input type="hidden" name="product" value={product} />
        <input type="hidden" name="sku" value={sku} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="pageUrl" value={pageUrl} />

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label" htmlFor="contact-name">Your name *</label>
            <input id="contact-name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="contact-email">Email *</label>
            <input id="contact-email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="contact-phone">Phone</label>
            <input id="contact-phone" name="phone" type="tel" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="contact-type">Enquiry type</label>
            <select id="contact-type" name="type" className="input" defaultValue={category.includes("metal") ? "Engineering metals" : "Mini panels"}>
              <option>Mini panels</option>
              <option>Engineering metals</option>
              <option>Bespoke fabrication</option>
              <option>General question</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="label" htmlFor="contact-message">Message *</label>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={6}
            className="input"
            defaultValue={defaultMessage}
            placeholder="Tell us what you're after - part numbers, dimensions, quantities..."
          />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-ink-muted">
            We will never share your details.
          </p>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Sending..." : "Send enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
