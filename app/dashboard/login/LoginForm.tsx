"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const twoFactorCode = String(formData.get("twoFactorCode") || "");
    const recoveryCode = String(formData.get("recoveryCode") || "");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          twoFactorCode,
          recoveryCode,
          next: nextPath,
        }),
      });
      const text = await res.text();
      let data: { error?: string; redirectTo?: string; requiresTwoFactor?: boolean } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (res.ok && data.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setLoading(false);
        return;
      }

      if (res.ok) {
        window.location.assign(data.redirectTo || nextPath || "/dashboard");
        return;
      }

      setError(data.error || `Sign in failed (${res.status})`);
      setLoading(false);
    } catch (err) {
      setError((err as Error).message || "Couldn't reach the server. Try again in a moment.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          name="email"
          className="input"
          placeholder="name@example.com"
          autoComplete="username"
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
          placeholder="Password"
          autoComplete="current-password"
          required
        />
      </div>

      {requiresTwoFactor && (
        <div className="rounded-lg border border-racing/10 bg-cream-dark p-4">
          <div className="mb-3 text-sm font-semibold text-racing">Two-factor verification</div>
          {!useRecoveryCode ? (
            <div>
              <label className="label">Authenticator code</label>
              <input
                type="text"
                name="twoFactorCode"
                className="input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </div>
          ) : (
            <div>
              <label className="label">Recovery code</label>
              <input
                type="text"
                name="recoveryCode"
                className="input"
                placeholder="ABCD-EFGH-JKLM"
                autoComplete="one-time-code"
              />
            </div>
          )}
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-racing hover:text-gold"
            onClick={() => setUseRecoveryCode((value) => !value)}
          >
            {useRecoveryCode ? "Use authenticator code" : "Use a recovery code"}
          </button>
        </div>
      )}

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? "Signing in..." : requiresTwoFactor ? "Verify and sign in" : "Sign in"}
      </button>

      <div className="text-center text-sm">
        <Link href="/dashboard/forgot-password" className="font-medium text-racing hover:text-gold">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}
