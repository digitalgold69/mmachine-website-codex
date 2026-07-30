"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInvitationForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
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
      const res = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: String(formData.get("name") || ""),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!res.ok) throw new Error(data.error || "The invitation could not be accepted.");
      router.replace(data.redirectTo || "/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "The invitation could not be accepted.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">Email</label>
        <input type="email" className="input bg-cream-dark" value={email} readOnly />
      </div>

      <div>
        <label className="label">Name</label>
        <input
          type="text"
          name="name"
          className="input"
          placeholder="Your name"
          autoComplete="name"
          required
          autoFocus
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="label mb-0">Password</label>
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
          placeholder="Create password"
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
        {loading ? "Creating account..." : "Create dashboard account"}
      </button>

      <div className="text-center text-sm">
        <Link href="/dashboard/login" className="font-medium text-racing hover:text-gold">
          Already have access?
        </Link>
      </div>
    </form>
  );
}
