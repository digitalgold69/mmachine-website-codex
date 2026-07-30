import { NextResponse } from "next/server";
import {
  acceptTeamInvitation,
  authErrorResponse,
  finishSuccessfulLogin,
  requireSameOrigin,
  setAuthCookie,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/request-limits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const rateLimit = await checkRateLimit(req, "accept-invitation", 10, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: { token?: string; name?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const user = await acceptTeamInvitation({
      token: String(body.token || ""),
      name: String(body.name || ""),
      password: String(body.password || ""),
      request: req,
    });
    const login = await finishSuccessfulLogin(user, req);
    const res = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
    setAuthCookie(res, login.session.token);
    return res;
  } catch (err) {
    return authErrorResponse(err, "Invitation could not be accepted.");
  }
}
