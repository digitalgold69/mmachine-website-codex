"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(formData.get("email") || "") }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "The reset request failed.");
      setMessage(data.message || "If that email has dashboard access, a reset link will be sent.");
      e.currentTarget.reset();
    } catch (err) {
      setError((err as Error).message || "The reset request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          name="email"
          className="input"
          placeholder="name@example.com"
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      {message && <div className="rounded bg-green-50 p-3 text-sm text-racing">{message}</div>}
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? "Sending..." : "Send reset link"}
      </button>

      <div className="text-center text-sm">
        <Link href="/dashboard/login" className="font-medium text-racing hover:text-gold">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
