"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!res.ok) throw new Error(data.error || "The password could not be reset.");
      router.replace(data.redirectTo || "/dashboard/login");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "The password could not be reset.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="label mb-0">New password</label>
          <button
            type="button"
            className="text-xs font-semibold text-racing hover:text-gold"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          className="input"
          placeholder="New password"
          autoComplete="new-password"
          required
        />
      </div>

      <div>
        <label className="label">Confirm password</label>
        <input
          type={showPassword ? "text" : "password"}
          name="confirmPassword"
          className="input"
          placeholder="Confirm password"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="rounded-lg bg-cream-dark p-3 text-xs leading-relaxed text-ink-muted">
        Passwords must be at least 12 characters and include uppercase, lowercase, number and symbol characters.
      </div>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? "Saving..." : "Save new password"}
      </button>

      <div className="text-center text-sm">
        <Link href="/dashboard/login" className="font-medium text-racing hover:text-gold">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
