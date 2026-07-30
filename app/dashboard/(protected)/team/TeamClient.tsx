"use client";

import { useMemo, useState } from "react";
import type { AuditLogRow, TeamInvitation, TeamUser } from "@/lib/auth";

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

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-muted">
                <th className="border-b border-racing/10 px-3 py-2">Name</th>
                <th className="border-b border-racing/10 px-3 py-2">Email</th>
                <th className="border-b border-racing/10 px-3 py-2">Role</th>
                <th className="border-b border-racing/10 px-3 py-2">Status</th>
                <th className="border-b border-racing/10 px-3 py-2">2FA</th>
                <th className="border-b border-racing/10 px-3 py-2">Invited</th>
                <th className="border-b border-racing/10 px-3 py-2">Last login</th>
                <th className="border-b border-racing/10 px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.users.map((user) => {
                const isFinalAdmin = user.role === "admin" && user.status === "active" && activeAdminCount <= 1;
                return (
                  <tr key={user.id} className="align-top">
                    <td className="border-b border-racing/5 px-3 py-3 font-semibold text-racing">
                      {user.name || "Unnamed"}
                      {user.id === currentUserId && <span className="ml-2 text-xs text-ink-muted">(you)</span>}
                    </td>
                    <td className="border-b border-racing/5 px-3 py-3 text-ink-muted">{user.email}</td>
                    <td className="border-b border-racing/5 px-3 py-3">
                      <select
                        className="input h-10 min-w-36 py-1 text-sm"
                        value={user.role}
                        disabled={Boolean(busy) || isFinalAdmin}
                        onChange={(e) =>
                          patch("change-role", { userId: user.id, role: e.target.value }, `role-${user.id}`)
                        }
                      >
                        <option value="member">Team Member</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td className="border-b border-racing/5 px-3 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="border-b border-racing/5 px-3 py-3">{user.totpEnabled ? "Enabled" : "Off"}</td>
                    <td className="border-b border-racing/5 px-3 py-3">{formatOptionalDate(user.invitedAt || user.createdAt)}</td>
                    <td className="border-b border-racing/5 px-3 py-3">{formatOptionalDate(user.lastLoginAt)}</td>
                    <td className="border-b border-racing/5 px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 text-sm"
                          disabled={Boolean(busy) || user.status !== "active"}
                          onClick={() => patch("send-reset", { userId: user.id }, `reset-${user.id}`)}
                        >
                          Send reset
                        </button>
                        {user.status === "disabled" ? (
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2 text-sm"
                            disabled={Boolean(busy)}
                            onClick={() => patch("enable", { userId: user.id }, `enable-${user.id}`)}
                          >
                            Enable
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2 text-sm"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
