import { NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  authErrorResponse,
  changeOwnPassword,
  confirmTwoFactorSetup,
  createSession,
  disableTwoFactor,
  getCurrentUser,
  regenerateRecoveryCodes,
  requireSameOrigin,
  setAuthCookie,
  startTwoFactorSetup,
} from "@/lib/auth";

export const runtime = "nodejs";

function unauthenticated() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const user = await getCurrentUser();
  if (!user) return unauthenticated();

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    currentPassword?: string;
    newPassword?: string;
    code?: string;
  };

  try {
    switch (body.action) {
      case "change-password": {
        const refreshedUser = await changeOwnPassword({
          user,
          currentPassword: String(body.currentPassword || ""),
          newPassword: String(body.newPassword || ""),
          request: req,
        });
        const session = await createSession(refreshedUser);
        const res = NextResponse.json({ ok: true, user: refreshedUser });
        setAuthCookie(res, session.token);
        return res;
      }
      case "start-2fa": {
        const setup = await startTwoFactorSetup({
          user,
          currentPassword: String(body.currentPassword || ""),
          request: req,
        });
        const qrSvg = await QRCode.toString(setup.otpauthUrl, {
          type: "svg",
          margin: 1,
          width: 210,
          color: { dark: "#0b3d2f", light: "#ffffff" },
        });
        return NextResponse.json({ ok: true, ...setup, qrSvg });
      }
      case "confirm-2fa": {
        const setup = await confirmTwoFactorSetup({
          user,
          code: String(body.code || ""),
          request: req,
        });
        const session = await createSession(setup.user);
        const res = NextResponse.json({
          ok: true,
          user: setup.user,
          recoveryCodes: setup.recoveryCodes,
        });
        setAuthCookie(res, session.token);
        return res;
      }
      case "disable-2fa": {
        const refreshedUser = await disableTwoFactor({
          user,
          currentPassword: String(body.currentPassword || ""),
          request: req,
        });
        const session = await createSession(refreshedUser);
        const res = NextResponse.json({ ok: true, user: refreshedUser });
        setAuthCookie(res, session.token);
        return res;
      }
      case "regenerate-recovery-codes": {
        const recoveryCodes = await regenerateRecoveryCodes({
          user,
          currentPassword: String(body.currentPassword || ""),
          request: req,
        });
        return NextResponse.json({ ok: true, recoveryCodes });
      }
      default:
        return NextResponse.json({ error: "Unknown security action." }, { status: 400 });
    }
  } catch (err) {
    return authErrorResponse(err, "Security settings could not be updated.");
  }
}
