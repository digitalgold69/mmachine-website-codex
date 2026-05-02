// POST /api/auth   — sign in (body: { password })
// DELETE /api/auth — sign out

import { NextResponse } from "next/server";
import { makeSessionToken, AUTH_COOKIE_NAME, AUTH_SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const expected = process.env.OWNER_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Server isn't configured. Set OWNER_PASSWORD in Vercel project settings." },
      { status: 500 }
    );
  }

  if (!body.password || body.password !== expected) {
    // Same response whether the password is missing or wrong — don't leak which
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = makeSessionToken();
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
