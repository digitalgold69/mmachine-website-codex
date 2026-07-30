import { NextResponse } from "next/server";
import {
  authErrorResponse,
  clearAuthCookie,
  requireSameOrigin,
  resetPasswordWithToken,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/request-limits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const rateLimit = await checkRateLimit(req, "reset-password", 8, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many reset attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: { token?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    await resetPasswordWithToken({
      token: String(body.token || ""),
      password: String(body.password || ""),
      request: req,
    });
    const res = NextResponse.json({ ok: true, redirectTo: "/dashboard/login" });
    clearAuthCookie(res);
    return res;
  } catch (err) {
    return authErrorResponse(err, "Password reset failed.");
  }
}
