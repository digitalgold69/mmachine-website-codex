"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
      alert("Something went wrong — please call us on 01325 381302.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-racing mb-3">Thanks — message received</h1>
        <p className="text-ink-muted mb-6">
          One of the team will come back to you within one working day. For urgent matters, call 01325 381302.
        </p>
        <Link href="/" className="btn-primary">Back to homepage</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/" className="text-sm text-ink-muted hover:text-racing">← Home</Link>
      <h1 className="font-display text-4xl text-racing mt-2 mb-3">Get in touch</h1>
      <p className="text-ink-muted mb-10 max-w-2xl">
        Place an order, ask for a quote, or get material advice. The fastest route is always a phone call —
        but fill this form and we&apos;ll come back to you within one working day.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        <aside className="md:col-span-1 space-y-6">
          <div>
            <h3 className="font-display text-lg text-racing mb-2">Phone</h3>
            <p className="text-sm text-ink-muted mb-1">Metals &amp; engineering</p>
            <a href="tel:01325381302" className="font-mono text-racing text-lg hover:text-gold">01325 381302</a>
            <p className="text-sm text-ink-muted mt-3 mb-1">Mini pressings &amp; accounts</p>
            <a href="tel:01325381300" className="font-mono text-racing text-lg hover:text-gold">01325 381300</a>
          </div>
          <div>
            <h3 className="font-display text-lg text-racing mb-2">Email</h3>
            <a href="mailto:sales@m-machine.co.uk" className="text-sm text-racing hover:text-gold">sales@m-machine.co.uk</a>
          </div>
          <div>
            <h3 className="font-display text-lg text-racing mb-2">Address</h3>
            <address className="not-italic text-sm text-ink-muted leading-relaxed">
              Unit 3–7 Forge Way<br />
              Cleveland Trading Estate<br />
              Darlington<br />
              County Durham DL1 2PJ
            </address>
          </div>
          <div className="bg-cream-dark rounded-lg p-4 border-l-4 border-gold">
            <p className="text-xs text-ink-muted">
              We don&apos;t take orders online — we write them down so we know what&apos;s on the shelf.
              Please don&apos;t email credit card details; we&apos;ll contact you for payment directly.
            </p>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="md:col-span-2 bg-white rounded-2xl border border-racing/10 p-6 md:p-8">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Your name *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" type="tel" className="input" />
            </div>
            <div>
              <label className="label">Enquiry type</label>
              <select name="type" className="input">
                <option>Mini panels</option>
                <option>Engineering metals</option>
                <option>Bespoke fabrication</option>
                <option>General question</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Message *</label>
            <textarea name="message" required rows={6} className="input" placeholder="Tell us what you're after — part numbers, dimensions, quantities..." />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-ink-muted">
              We&apos;ll never share your details. See our privacy policy.
            </p>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Sending…" : "Send enquiry →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
