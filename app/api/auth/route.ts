// POST /api/auth   — sign in (body: { password })
// DELETE /api/auth — sign out

import { NextResponse } from "next/server";
import { makeSessionToken, AUTH_COOKIE_NAME, AUTH_SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import crypto from "node:crypto";
import { checkRateLimit } from "@/lib/request-limits";

export const runtime = "nodejs";

function timingSafeStringEqual(value: string, expected: string) {
  const valueHash = crypto.createHash("sha256").update(value).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(valueHash, expectedHash);
}

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(req, "owner-login", 8, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const expected = process.env.OWNER_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Owner login is temporarily unavailable." },
      { status: 500 }
    );
  }

  if (!body.password || !timingSafeStringEqual(body.password, expected)) {
    // Same response whether the password is missing or wrong — don't leak which
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  let token = "";
  try {
    token = makeSessionToken();
  } catch (err) {
    return NextResponse.json(
      { error: "Owner login is temporarily unavailable." },
      { status: 500 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
