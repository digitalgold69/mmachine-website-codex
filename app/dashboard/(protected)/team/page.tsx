import { redirect } from "next/navigation";
import { getCurrentUser, listAuditEvents, listTeam } from "@/lib/auth";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dashboard/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [team, audit] = await Promise.all([listTeam(), listAuditEvents()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing mb-1">Team management</h1>
        <p className="text-sm text-ink-muted">
          Control dashboard access, invitations, password resets and security status.
        </p>
      </div>

      <TeamClient initialTeam={team} initialAudit={audit} currentUserId={user.id} />
    </div>
  );
}
