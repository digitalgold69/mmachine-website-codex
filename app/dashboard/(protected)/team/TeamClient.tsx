"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuditLogRow, NotificationRoute, TeamInvitation, TeamUser } from "@/lib/auth";

type TeamState = {
  users: TeamUser[];
  invitations: TeamInvitation[];
};

type TeamClientProps = {
  initialTeam: TeamState;
  initialAudit: AuditLogRow[];
  currentUserId: string;
};

type ApiResponse = {
  ok?: boolean;
  warning?: string | null;
  error?: string;
  team?: TeamState;
  audit?: AuditLogRow[];
};

const notificationOptions: { id: NotificationRoute; label: string }[] = [
  { id: "mini", label: "Mini panels" },
  { id: "metals", label: "Metals" },
  { id: "custom", label: "Custom work" },
  { id: "featured", label: "Featured work" },
];

export default function TeamClient({ initialTeam, initialAudit, currentUserId }: TeamClientProps) {
  const [team, setTeam] = useState(initialTeam);
  const [audit, setAudit] = useState(initialAudit);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeAdminCount = useMemo(
    () => team.users.filter((user) => user.role === "admin" && user.status === "active").length,
    [team.users]
  );

  async function applyResponse(res: Response) {
    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok) throw new Error(data.error || "The team action failed.");
    if (data.team) setTeam(data.team);
    if (data.audit) setAudit(data.audit);
    setMessage(data.warning || "Saved.");
    return data;
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setBusy("invite");
    setError("");
    setMessage("");
    try {
      await applyResponse(
        await fetch("/api/team", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(formData.get("email") || ""),
            role: String(formData.get("role") || "member"),
          }),
        })
      );
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function patch(action: string, payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await applyResponse(
        await fetch("/api/team", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        })
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function removeUser(user: TeamUser) {
    if (!window.confirm(`${user.email} will be removed from dashboard access.`)) return;
    setBusy(`remove-${user.id}`);
    setError("");
    setMessage("");
    try {
      await applyResponse(
        await fetch("/api/team", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-racing">Invite team member</h2>
          </div>
        </div>
        <form onSubmit={invite} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
          <div>
            <label className="label">Email</label>
            <input type="email" name="email" className="input" placeholder="name@example.com" required />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="member">
              <option value="member">Team Member</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <button type="submit" disabled={busy === "invite"} className="btn-primary justify-center">
            {busy === "invite" ? "Sending..." : "Send invite"}
          </button>
        </form>
      </section>

      {team.invitations.length > 0 && (
        <section className="rounded-xl border border-racing/10 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-racing">Pending invitations</h2>
            <span className="rounded-full bg-cream-dark px-3 py-1 text-sm font-semibold text-racing">
              {team.invitations.length}
            </span>
          </div>
          <div className="divide-y divide-racing/10">
            {team.invitations.map((invite) => (
              <div key={invite.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_150px_170px_auto] md:items-center">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-racing">{invite.email}</div>
                  <div className="text-xs text-ink-muted">Invited {formatDate(invite.createdAt)}</div>
                </div>
                <div className="text-sm text-ink-muted">{roleLabel(invite.role)}</div>
                <div className="text-sm text-ink-muted">Expires {formatDate(invite.expiresAt)}</div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-sm"
                    disabled={Boolean(busy)}
                    onClick={() => patch("resend-invite", { invitationId: invite.id }, `resend-${invite.id}`)}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-red-700 hover:text-red-900"
                    disabled={Boolean(busy)}
                    onClick={() => patch("cancel-invite", { invitationId: invite.id }, `cancel-${invite.id}`)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-racing/10 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-racing">Team members</h2>
          <span className="rounded-full bg-cream-dark px-3 py-1 text-sm font-semibold text-racing">
            {team.users.length}
          </span>
        </div>

        <div className="divide-y divide-racing/10">
          {team.users.map((user) => {
            const isFinalAdmin = user.role === "admin" && user.status === "active" && activeAdminCount <= 1;
            return (
              <div
                key={user.id}
                className="grid gap-5 py-5 lg:grid-cols-[minmax(260px,1.35fr)_170px_190px_minmax(230px,0.95fr)_150px] lg:items-start"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="truncate font-semibold text-racing">{user.name || "Unnamed"}</h3>
                    {user.id === currentUserId && <span className="text-xs font-semibold text-ink-muted">(you)</span>}
                  </div>
                  <p className="mt-1 break-all text-sm text-ink-muted">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>Invited {formatOptionalDate(user.invitedAt || user.createdAt)}</span>
                    <span>Last login {formatOptionalDate(user.lastLoginAt)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Access</div>
                  <select
                    className="input h-10 py-1 text-sm"
                    value={user.role}
                    disabled={Boolean(busy) || isFinalAdmin}
                    onChange={(e) =>
                      patch("change-role", { userId: user.id, role: e.target.value }, `role-${user.id}`)
                    }
                  >
                    <option value="member">Team Member</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <StatusBadge status={user.status} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">2FA</div>
                  <TwoFactorControl
                    user={user}
                    currentUserId={currentUserId}
                    busy={busy}
                    onPatch={patch}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Notifications</div>
                  <NotificationPicker
                    user={user}
                    busy={busy}
                    onSave={(routes) =>
                      patch("notifications", { userId: user.id, routes }, `notifications-${user.id}`)
                    }
                  />
                </div>

                <div className="space-y-2 lg:text-right">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Actions</div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      className="btn-secondary justify-center px-3 py-2 text-sm"
                      disabled={Boolean(busy) || user.status !== "active"}
                      onClick={() => patch("send-reset", { userId: user.id }, `reset-${user.id}`)}
                    >
                      Send reset
                    </button>
                    {user.status === "disabled" ? (
                      <button
                        type="button"
                        className="btn-secondary justify-center px-3 py-2 text-sm"
                        disabled={Boolean(busy)}
                        onClick={() => patch("enable", { userId: user.id }, `enable-${user.id}`)}
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary justify-center px-3 py-2 text-sm"
                        disabled={Boolean(busy) || isFinalAdmin}
                        onClick={() => patch("disable", { userId: user.id }, `disable-${user.id}`)}
                      >
                        Disable
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-3 py-2 text-sm font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
                      disabled={Boolean(busy) || isFinalAdmin}
                      onClick={() => removeUser(user)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-racing/10 bg-white p-5">
        <h2 className="mb-4 font-display text-2xl text-racing">Recent security events</h2>
        {audit.length === 0 ? (
          <div className="rounded-lg bg-cream-dark p-4 text-sm text-ink-muted">No audit events yet.</div>
        ) : (
          <div className="divide-y divide-racing/10">
            {audit.map((event) => (
              <div key={event.id} className="grid gap-2 py-3 text-sm md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="text-ink-muted">{formatDate(event.createdAt)}</div>
                <div className="font-semibold text-racing">{eventLabel(event.event)}</div>
                <div className="min-w-0 text-ink-muted">
                  {[event.subjectEmail, event.actorEmail ? `by ${event.actorEmail}` : ""].filter(Boolean).join(" ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: TeamUser["status"] }) {
  const label = status === "active" ? "Active" : status === "disabled" ? "Disabled" : "Removed";
  const classes =
    status === "active"
      ? "bg-green-50 text-racing"
      : status === "disabled"
        ? "bg-amber-50 text-amber-800"
        : "bg-red-50 text-red-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{label}</span>;
}

function TwoFactorControl({
  user,
  currentUserId,
  busy,
  onPatch,
}: {
  user: TeamUser;
  currentUserId: string;
  busy: string;
  onPatch: (action: string, payload: Record<string, unknown>, label: string) => Promise<void>;
}) {
  const disabled = Boolean(busy) || user.status !== "active";
  const isCurrentUser = user.id === currentUserId;
  const requirementActive = user.requireTwoFactorSetup && !user.totpEnabled;

  if (isCurrentUser) {
    return (
      <div className="space-y-2">
        <SecurityBadge enabled={user.totpEnabled} required={requirementActive} />
        <Link href="/dashboard/account/security" className="btn-secondary justify-center px-3 py-2 text-sm">
          {user.totpEnabled ? "Manage 2FA" : "Set up 2FA"}
        </Link>
      </div>
    );
  }

  if (user.totpEnabled) {
    return (
      <div className="space-y-2">
        <SecurityBadge enabled required={false} />
        <button
          type="button"
          className="text-sm font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            if (window.confirm(`Turn off 2FA for ${user.email}? They will need to set it up again if required.`)) {
              onPatch("disable-2fa", { userId: user.id }, `disable-2fa-${user.id}`);
            }
          }}
        >
          Turn off 2FA
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SecurityBadge enabled={false} required={requirementActive} />
      <button
        type="button"
        className="btn-secondary justify-center px-3 py-2 text-sm"
        disabled={disabled}
        onClick={() =>
          onPatch(
            "require-2fa",
            { userId: user.id, required: !requirementActive },
            `require-2fa-${user.id}`
          )
        }
      >
        {requirementActive ? "Cancel requirement" : "Require 2FA"}
      </button>
    </div>
  );
}

function SecurityBadge({ enabled, required }: { enabled: boolean; required: boolean }) {
  const label = enabled ? "Enabled" : required ? "Required" : "Off";
  const classes = enabled
    ? "bg-green-50 text-racing"
    : required
      ? "bg-amber-50 text-amber-800"
      : "bg-cream-dark text-ink-muted";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{label}</span>;
}

function NotificationPicker({
  user,
  busy,
  onSave,
}: {
  user: TeamUser;
  busy: string;
  onSave: (routes: NotificationRoute[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NotificationRoute[]>(user.notificationRoutes || []);
  const [open, setOpen] = useState(false);
  const busyKey = `notifications-${user.id}`;
  const saving = busy === busyKey;
  const disabled = Boolean(busy) || user.status !== "active";
  const selectedLabels = notificationOptions
    .filter((option) => draft.includes(option.id))
    .map((option) => option.label);
  const originalKey = (user.notificationRoutes || []).join("|");
  const draftKey = draft.join("|");

  useEffect(() => {
    setDraft(user.notificationRoutes || []);
    setOpen(false);
  }, [originalKey, user.notificationRoutes]);

  function toggle(route: NotificationRoute, checked: boolean) {
    setDraft((current) => {
      const next = checked ? [...current, route] : current.filter((item) => item !== route);
      return notificationOptions.map((option) => option.id).filter((option) => next.includes(option));
    });
  }

  async function save() {
    await onSave(draft);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-racing/10 bg-white px-3 text-left text-sm font-semibold text-racing hover:border-racing/30 disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="max-w-40 truncate">
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Default fallback"}
        </span>
        <span aria-hidden="true" className="text-xs text-ink-muted">{open ? "^" : "v"}</span>
      </button>
      {open && (
      <div className="absolute left-0 z-30 mt-2 w-72 rounded-lg border border-racing/10 bg-cream p-3 text-left shadow-xl">
        <div className="space-y-2">
          {notificationOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-racing"
                checked={draft.includes(option.id)}
                disabled={disabled}
                onChange={(event) => toggle(option.id, event.target.checked)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-muted">
          Empty uses the Cloudflare fallback. Disabled users do not receive emails.
        </p>
        <button
          type="button"
          className="btn-secondary mt-3 w-full justify-center px-3 py-2 text-sm"
          disabled={disabled || draftKey === originalKey}
          onClick={save}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      )}
    </div>
  );
}

function roleLabel(role: "admin" | "member") {
  return role === "admin" ? "Administrator" : "Team Member";
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : "Never";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function eventLabel(event: string) {
  return event
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
