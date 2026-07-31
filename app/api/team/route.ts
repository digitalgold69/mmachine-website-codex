import { NextResponse } from "next/server";
import {
  authErrorResponse,
  cancelTeamInvitation,
  createPasswordReset,
  createTeamInvitation,
  disableTeamUserTwoFactor,
  disableTeamUser,
  enableTeamUser,
  listAuditEvents,
  listTeam,
  removeTeamUser,
  requireAdminUser,
  requireSameOrigin,
  resendTeamInvitation,
  setTeamUserTwoFactorRequirement,
  updateTeamUserNotificationRoutes,
  updateTeamUserRole,
  type AuthRole,
} from "@/lib/auth";
import { sendPasswordResetEmail, sendTeamInvitationEmail } from "@/lib/auth-email";

export const runtime = "nodejs";

async function adminFromRequest() {
  return requireAdminUser();
}

export async function GET() {
  try {
    await adminFromRequest();
    return NextResponse.json({ ok: true, team: await listTeam(), audit: await listAuditEvents() });
  } catch (err) {
    return authErrorResponse(err, "Team could not be loaded.");
  }
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  try {
    const actor = await adminFromRequest();
    const body = (await req.json().catch(() => ({}))) as { email?: string; role?: AuthRole };
    const { invitation, token } = await createTeamInvitation({
      email: String(body.email || ""),
      role: body.role === "admin" ? "admin" : "member",
      actor,
      request: req,
    });
    const delivery = await sendTeamInvitationEmail({
      to: invitation.email,
      role: invitation.role,
      token,
    });

    return NextResponse.json({
      ok: delivery.ok,
      warning: delivery.ok ? null : "Invitation was saved, but the email could not be sent.",
      invitation,
      delivery,
      team: await listTeam(),
      audit: await listAuditEvents(),
    });
  } catch (err) {
    return authErrorResponse(err, "Invitation could not be created.");
  }
}

export async function PATCH(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  try {
    const actor = await adminFromRequest();
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      userId?: string;
      invitationId?: string;
      role?: AuthRole;
      routes?: unknown;
      required?: boolean;
    };

    let delivery: unknown = null;
    let warning: string | null = null;

    switch (body.action) {
      case "resend-invite": {
        const { invitation, token } = await resendTeamInvitation({
          invitationId: String(body.invitationId || ""),
          actor,
          request: req,
        });
        delivery = await sendTeamInvitationEmail({
          to: invitation.email,
          role: invitation.role,
          token,
        });
        if (!(delivery as { ok?: boolean }).ok) warning = "Invitation was updated, but the email could not be sent.";
        break;
      }
      case "cancel-invite":
        await cancelTeamInvitation({
          invitationId: String(body.invitationId || ""),
          actor,
          request: req,
        });
        break;
      case "change-role":
        await updateTeamUserRole({
          userId: String(body.userId || ""),
          role: body.role === "admin" ? "admin" : "member",
          actor,
          request: req,
        });
        break;
      case "notifications":
        await updateTeamUserNotificationRoutes({
          userId: String(body.userId || ""),
          routes: body.routes,
          actor,
          request: req,
        });
        break;
      case "require-2fa":
        await setTeamUserTwoFactorRequirement({
          userId: String(body.userId || ""),
          required: Boolean(body.required),
          actor,
          request: req,
        });
        break;
      case "disable-2fa":
        await disableTeamUserTwoFactor({
          userId: String(body.userId || ""),
          actor,
          request: req,
        });
        break;
      case "send-reset": {
        const userId = String(body.userId || "");
        const team = await listTeam();
        const target = team.users.find((user) => user.id === userId);
        if (!target) {
          return NextResponse.json({ error: "User not found." }, { status: 404 });
        }
        const reset = await createPasswordReset({
          email: target.email,
          requestedBy: actor,
          request: req,
        });
        if (!reset) {
          return NextResponse.json({ error: "A reset link could not be created for that user." }, { status: 400 });
        }
        delivery = await sendPasswordResetEmail({
          to: reset.user.email,
          token: reset.token,
          adminTriggered: true,
        });
        if (!(delivery as { ok?: boolean }).ok) warning = "Reset link was created, but the email could not be sent.";
        break;
      }
      case "disable":
        await disableTeamUser({ userId: String(body.userId || ""), actor, request: req });
        break;
      case "enable":
        await enableTeamUser({ userId: String(body.userId || ""), actor, request: req });
        break;
      default:
        return NextResponse.json({ error: "Unknown team action." }, { status: 400 });
    }

    return NextResponse.json({
      ok: !warning,
      warning,
      delivery,
      team: await listTeam(),
      audit: await listAuditEvents(),
    });
  } catch (err) {
    return authErrorResponse(err, "Team action failed.");
  }
}

export async function DELETE(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  try {
    const actor = await adminFromRequest();
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    await removeTeamUser({ userId: String(body.userId || ""), actor, request: req });
    return NextResponse.json({ ok: true, team: await listTeam(), audit: await listAuditEvents() });
  } catch (err) {
    return authErrorResponse(err, "User could not be removed.");
  }
}
