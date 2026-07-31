"use client";

import { useState } from "react";
import type { AuthUser } from "@/lib/auth";

type PublicUser = Pick<AuthUser, "email" | "name" | "role" | "mustChangePassword" | "totpEnabled">;

type SecurityClientProps = {
  initialUser: PublicUser;
  requiredReason: "password" | "2fa" | null;
};

type SecurityResponse = {
  ok?: boolean;
  error?: string;
  user?: PublicUser;
  secret?: string;
  otpauthUrl?: string;
  qrSvg?: string;
  recoveryCodes?: string[];
};

export default function SecurityClient({ initialUser, requiredReason }: SecurityClientProps) {
  const [user, setUser] = useState(initialUser);
  const [message, setMessage] = useState(
    requiredReason === "password"
      ? "Please choose a new password before continuing."
      : requiredReason === "2fa"
        ? "Please set up two-factor authentication before continuing."
        : ""
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function post(action: string, payload: Record<string, unknown>) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/security", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as SecurityResponse;
      if (!res.ok) throw new Error(data.error || "Security settings could not be updated.");
      if (data.user) setUser(data.user);
      return data;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    const data = await post("change-password", {
      currentPassword: String(formData.get("currentPassword") || ""),
      newPassword,
    });
    if (data?.ok) {
      setMessage("Password updated.");
      form.reset();
    }
  }

  async function startTwoFactor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = await post("start-2fa", {
      currentPassword: String(formData.get("currentPassword") || ""),
    });
    if (data?.secret && data.qrSvg) {
      setSetup({ secret: data.secret, qrSvg: data.qrSvg });
      setMessage("Scan the QR code, then enter the 6-digit code to finish setup.");
    }
  }

  async function confirmTwoFactor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = await post("confirm-2fa", {
      code: String(formData.get("code") || ""),
    });
    if (data?.recoveryCodes) {
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setMessage("Two-factor authentication is now enabled. Save the recovery codes below.");
      form.reset();
    }
  }

  async function disableTwoFactor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = await post("disable-2fa", {
      currentPassword: String(formData.get("currentPassword") || ""),
    });
    if (data?.ok) {
      setRecoveryCodes([]);
      setMessage("Two-factor authentication has been disabled.");
      form.reset();
    }
  }

  async function regenerateCodes(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = await post("regenerate-recovery-codes", {
      currentPassword: String(formData.get("currentPassword") || ""),
    });
    if (data?.recoveryCodes) {
      setRecoveryCodes(data.recoveryCodes);
      setMessage("New recovery codes generated. The old codes no longer work.");
      form.reset();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="space-y-6">
        {(message || error) && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              error ? "border-red-200 bg-red-50 text-red-800" : "border-racing/10 bg-green-50 text-racing"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="rounded-xl border border-racing/10 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-racing">Password</h2>
              <p className="text-sm text-ink-muted">{user.email}</p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-racing hover:text-gold"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="label">Current password</label>
              <input
                type={showPassword ? "text" : "password"}
                name="currentPassword"
                className="input"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">New password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  className="input"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  className="input"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div className="rounded-lg bg-cream-dark p-3 text-xs leading-relaxed text-ink-muted">
              Use at least 12 characters with uppercase, lowercase, number and symbol characters.
            </div>
            <button type="submit" disabled={busy === "change-password"} className="btn-primary">
              {busy === "change-password" ? "Saving..." : "Update password"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-racing/10 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-racing">Two-factor authentication</h2>
              <p className="text-sm text-ink-muted">
                Status: <span className="font-semibold text-racing">{user.totpEnabled ? "Enabled" : "Off"}</span>
              </p>
            </div>
          </div>

          {!user.totpEnabled ? (
            <div className="space-y-5">
              <form onSubmit={startTwoFactor} className="space-y-4">
                <div>
                  <label className="label">Confirm password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="currentPassword"
                    className="input"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <button type="submit" disabled={busy === "start-2fa"} className="btn-primary">
                  {busy === "start-2fa" ? "Preparing..." : "Set up 2FA"}
                </button>
              </form>

              {setup && (
                <div className="rounded-xl border border-racing/10 bg-cream-dark p-4">
                  <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div
                      className="rounded-lg bg-white p-2"
                      aria-label="Authenticator QR code"
                      dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
                    />
                    <div className="min-w-0">
                      <div className="mb-2 text-sm font-semibold text-racing">Manual setup key</div>
                      <div className="break-all rounded bg-white p-3 font-mono text-xs text-ink">{setup.secret}</div>
                    </div>
                  </div>
                  <form onSubmit={confirmTwoFactor} className="mt-4 grid gap-3 md:grid-cols-[180px_auto] md:items-end">
                    <div>
                      <label className="label">6-digit code</label>
                      <input
                        type="text"
                        name="code"
                        className="input"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        placeholder="123456"
                        required
                      />
                    </div>
                    <button type="submit" disabled={busy === "confirm-2fa"} className="btn-primary justify-center">
                      {busy === "confirm-2fa" ? "Checking..." : "Enable 2FA"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <form onSubmit={regenerateCodes} className="rounded-xl border border-racing/10 bg-cream-dark p-4">
                <h3 className="mb-3 font-semibold text-racing">Recovery codes</h3>
                <label className="label">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="currentPassword"
                  className="input"
                  autoComplete="current-password"
                  required
                />
                <button type="submit" disabled={busy === "regenerate-recovery-codes"} className="btn-secondary mt-3">
                  {busy === "regenerate-recovery-codes" ? "Generating..." : "Generate new codes"}
                </button>
              </form>

              <form onSubmit={disableTwoFactor} className="rounded-xl border border-racing/10 bg-cream-dark p-4">
                <h3 className="mb-3 font-semibold text-racing">Disable 2FA</h3>
                <label className="label">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="currentPassword"
                  className="input"
                  autoComplete="current-password"
                  required
                />
                <button type="submit" disabled={busy === "disable-2fa"} className="mt-3 font-semibold text-red-700 hover:text-red-900">
                  {busy === "disable-2fa" ? "Disabling..." : "Disable 2FA"}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-xl border border-racing/10 bg-white p-5">
          <h2 className="font-display text-2xl text-racing">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted">Name</dt>
              <dd className="font-semibold text-racing">{user.name || "Unnamed"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="break-all font-semibold text-racing">{user.email}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Role</dt>
              <dd className="font-semibold text-racing">{user.role === "admin" ? "Administrator" : "Team Member"}</dd>
            </div>
          </dl>
        </section>

        {recoveryCodes.length > 0 && (
          <section className="rounded-xl border border-gold/30 bg-white p-5">
            <h2 className="font-display text-2xl text-racing">Recovery codes</h2>
            <p className="mb-4 text-sm text-ink-muted">
              Save these now. Each code works once and will not be shown again.
            </p>
            <div className="grid gap-2">
              {recoveryCodes.map((code) => (
                <div key={code} className="rounded bg-cream-dark px-3 py-2 font-mono text-sm text-racing">
                  {code}
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
