"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (res.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(data.error || `Sign in failed (${res.status})`);
        setLoading(false);
      }
    } catch (err) {
      setError((err as Error).message || "Couldn't reach the server. Try again in a moment.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-full bg-racing flex items-center justify-center text-cream font-bold">M</div>
          <span className="font-display text-xl text-racing">M-Machine owner dashboard</span>
        </Link>

        <div className="bg-white rounded-2xl border border-racing/10 p-8">
          <h1 className="font-display text-2xl text-racing mb-2">Sign in</h1>
          <p className="text-sm text-ink-muted mb-6">Enter the owner password to manage orders and website content.</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="label">Password</label>
              <input
                type="password"
                name="password"
                className="input"
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 p-2 rounded">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
