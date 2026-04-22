"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Demo: any email/password works. In production, swap for real auth.
    setTimeout(() => router.push("/dashboard"), 400);
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
          <p className="text-sm text-ink-muted mb-6">Access the admin dashboard to manage products and featured work.</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="owner@m-machine.co.uk" required />
            </div>
            <div className="mb-6">
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="••••••••" required />
            </div>
            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 p-2 rounded">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <p className="text-xs text-ink-muted text-center mt-6">
            <strong>Demo:</strong> any email &amp; password will sign you in.
          </p>
        </div>
      </div>
    </div>
  );
}
