// Tiny session helper — signs a cookie with a server-side secret so the
// browser can't forge a "logged in" state. No database, no third-party auth
// service. Suitable for a single-owner admin where the threat model is
// "casual website visitors shouldn't be able to edit content".
//
// Env vars (set in Vercel project settings, NOT committed):
//   OWNER_PASSWORD  the password the owner types into the login form
//   AUTH_SECRET     32+ random characters used to sign cookies. If you ever
//                   want to invalidate all existing sessions, rotate this.

import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "mmachine_admin";
const SESSION_DAYS = 14;

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET env var is missing or too short (min 16 chars). " +
      "Set it in Vercel → Project Settings → Environment Variables."
    );
  }
  return s;
}

function sign(payload: string): string {
  const h = crypto.createHmac("sha256", getSecret());
  h.update(payload);
  return h.digest("hex");
}

export function makeSessionToken(): string {
  // Token format: <issued-at>.<signature>
  // We don't need to put a username in here — there's only one user.
  const issuedAt = Date.now();
  const payload = String(issuedAt);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = sign(payload);
  if (signature !== expected) return false;
  const issuedAt = parseInt(payload, 10);
  if (!Number.isFinite(issuedAt)) return false;
  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0) return false;
  if (ageMs > SESSION_DAYS * 24 * 60 * 60 * 1000) return false;
  return true;
}

export async function isLoggedIn(): Promise<boolean> {
  const c = await cookies();
  return verifySessionToken(c.get(COOKIE_NAME)?.value);
}

export async function requireLogin(): Promise<Response | null> {
  const ok = await isLoggedIn();
  if (ok) return null;
  return new Response(
    JSON.stringify({ error: "Not signed in" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
