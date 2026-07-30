import { NextResponse } from "next/server";
import {
  clearAuthCookie,
  finishSuccessfulLogin,
  recordAuditEvent,
  requireSameOrigin,
  revokeCurrentSession,
  safeDashboardRedirect,
  setAuthCookie,
  verifyLoginPassword,
  verifyRecoveryCode,
  verifyTotpCode,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/request-limits";

export const runtime = "nodejs";

function publicUser(user: {
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
  totpEnabled: boolean;
}) {
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    totpEnabled: user.totpEnabled,
  };
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (err) {
    console.error("dashboard_login_unhandled_error", {
      error: err instanceof Error ? err.message : "unknown error",
      name: err instanceof Error ? err.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Dashboard sign in is temporarily unavailable." },
      { status: 500 }
    );
  }
}

async function handlePost(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const rateLimit = await checkRateLimit(req, "dashboard-login", 12, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: {
    email?: string;
    password?: string;
    twoFactorCode?: string;
    recoveryCode?: string;
    next?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const verified = await verifyLoginPassword(email, password, req);
  if (!verified.ok) {
    const message =
      verified.code === "locked"
        ? "Too many failed attempts. Please wait a few minutes and try again."
        : "The email or password was not recognised.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (verified.user.totpEnabled) {
    const twoFactorCode = typeof body.twoFactorCode === "string" ? body.twoFactorCode : "";
    const recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode : "";
    if (!twoFactorCode && !recoveryCode) {
      return NextResponse.json({
        ok: false,
        requiresTwoFactor: true,
        user: publicUser(verified.user),
      });
    }

    const passed = twoFactorCode
      ? Boolean(verified.totpSecret && verifyTotpCode(verified.totpSecret, twoFactorCode))
      : await verifyRecoveryCode(verified.user.id, recoveryCode);

    if (!passed) {
      await recordAuditEvent({
        actor: null,
        event: twoFactorCode ? "login_failed_two_factor" : "login_failed_recovery_code",
        subjectUserId: verified.user.id,
        subjectEmail: verified.user.email,
        request: req,
      });
      return NextResponse.json({ error: "The verification code was not accepted." }, { status: 401 });
    }
  }

  const login = await finishSuccessfulLogin(verified.user, req);
  const redirectTo = login.user.mustChangePassword
    ? "/dashboard/account/security?required=1"
    : safeDashboardRedirect(body.next, "/dashboard");
  const res = NextResponse.json({
    ok: true,
    redirectTo,
    user: publicUser(login.user),
  });
  setAuthCookie(res, login.session.token);
  return res;
}

export async function DELETE(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  await revokeCurrentSession();
  const res = NextResponse.json({ ok: true });
  clearAuthCookie(res);
  return res;
}
