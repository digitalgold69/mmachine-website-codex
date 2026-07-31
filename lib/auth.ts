import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import nodeCrypto from "node:crypto";
import { getD1, type D1DatabaseBinding } from "./cloudflare";

export type AuthRole = "admin" | "member";
export type AuthStatus = "active" | "disabled" | "removed";
export type NotificationRoute = "mini" | "metals" | "custom" | "featured";

export const NOTIFICATION_ROUTES: NotificationRoute[] = ["mini", "metals", "custom", "featured"];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  status: AuthStatus;
  mustChangePassword: boolean;
  requireTwoFactorSetup: boolean;
  totpEnabled: boolean;
  createdAt: string;
  invitedAt: string | null;
  lastLoginAt: string | null;
  disabledAt: string | null;
  removedAt: string | null;
  lockedUntil: string | null;
  securityVersion: number;
};

export type AuthSession = {
  id: string;
  user: AuthUser;
  expiresAt: string;
  tokenHash: string;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: AuthRole;
  status: "pending" | "accepted" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  invitedBy: string | null;
};

export type TeamUser = Pick<
  AuthUser,
  | "id"
  | "email"
  | "name"
  | "role"
  | "status"
  | "requireTwoFactorSetup"
  | "totpEnabled"
  | "createdAt"
  | "invitedAt"
  | "lastLoginAt"
  | "disabledAt"
> & {
  notificationRoutes: NotificationRoute[];
};

export type AuditLogRow = {
  id: string;
  actorEmail: string | null;
  event: string;
  subjectEmail: string | null;
  createdAt: string;
};

export type AuditActor = Pick<AuthUser, "id" | "email" | "role"> | null;

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "AuthError";
    this.status = options.status ?? 400;
    this.code = options.code ?? "auth_error";
  }
}

export function authErrorResponse(err: unknown, fallback = "The request could not be completed.") {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("auth_unhandled_error", {
    error: err instanceof Error ? err.message : "unknown error",
    name: err instanceof Error ? err.name : "UnknownError",
  });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

const COOKIE_NAME = "mmachine_session";
const SESSION_DAYS = 400;
const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100000;
const INITIAL_ADMIN_EMAIL = "hodltid@icloud.com";
const INITIAL_ADMIN_PASSWORD_HASH =
  "pbkdf2$100000$CaDlpYE7qMhytXbcyzD2BA$JooIXzOqEfW75L8YGG2nrW8Qw5DpBCppw5ZXDHdHizE";

const textEncoder = new TextEncoder();
let schemaReady: Promise<void> | null = null;

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_SECONDS;

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function addHours(hours: number) {
  return addSeconds(hours * 60 * 60);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0);
}

function boolFromDb(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  const clean = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

function randomId(prefix: string) {
  return `${prefix}_${nodeCrypto.randomUUID().replace(/-/g, "")}`;
}

function randomToken(bytes = 32) {
  return nodeCrypto.randomBytes(bytes).toString("base64url");
}

function sha256(value: string) {
  return nodeCrypto.createHash("sha256").update(value).digest("base64url");
}

function hashToken(token: string) {
  return sha256(token);
}

function base64UrlDecode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return nodeCrypto.timingSafeEqual(a, b);
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const subtle = globalThis.crypto?.subtle ?? nodeCrypto.webcrypto.subtle;
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const key = await subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    256
  );
  return Buffer.from(bits);
}

export async function hashPassword(password: string) {
  const salt = nodeCrypto.randomBytes(16);
  const hash = await derivePbkdf2(password, salt, PASSWORD_ITERATIONS);
  return ["pbkdf2", PASSWORD_ITERATIONS, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !iterationsRaw || !saltRaw || !hashRaw) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 100000) return false;

  const salt = base64UrlDecode(saltRaw);
  const expected = base64UrlDecode(hashRaw);
  const actual = await derivePbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

export function passwordPolicyErrors(password: string, email?: string) {
  const errors: string[] = [];
  const cleanEmail = email ? normalizeEmail(email) : "";
  const localPart = cleanEmail.split("@")[0] || "";

  if (password.length < 12) errors.push("Use at least 12 characters.");
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter.");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Add a number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Add a symbol.");
  if (cleanEmail && password.toLowerCase().includes(cleanEmail)) {
    errors.push("Do not include the email address.");
  }
  if (localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    errors.push("Do not include the email name.");
  }

  return errors;
}

function validateRole(role: string): AuthRole {
  if (role === "admin" || role === "member") return role;
  throw new AuthError("Choose a valid role.", { code: "invalid_role" });
}

function validateNotificationRoute(route: string): NotificationRoute {
  if ((NOTIFICATION_ROUTES as string[]).includes(route)) return route as NotificationRoute;
  throw new AuthError("Choose a valid notification type.", { code: "invalid_notification_route" });
}

function normalizeNotificationRoutes(routes: unknown): NotificationRoute[] {
  if (!Array.isArray(routes)) return [];
  const unique = new Set<NotificationRoute>();
  for (const route of routes) {
    if (typeof route === "string" && (NOTIFICATION_ROUTES as string[]).includes(route)) {
      unique.add(route as NotificationRoute);
    }
  }
  return NOTIFICATION_ROUTES.filter((route) => unique.has(route));
}

function userFromRow(row: Record<string, unknown>): AuthUser {
  return {
    id: asString(row.id),
    email: asString(row.email),
    name: asString(row.name),
    role: validateRole(asString(row.role)),
    status: (asString(row.status) || "active") as AuthStatus,
    mustChangePassword: boolFromDb(row.must_change_password),
    requireTwoFactorSetup: boolFromDb(row.require_two_factor_setup),
    totpEnabled: boolFromDb(row.totp_enabled),
    createdAt: asString(row.created_at),
    invitedAt: asNullableString(row.invited_at),
    lastLoginAt: asNullableString(row.last_login_at),
    disabledAt: asNullableString(row.disabled_at),
    removedAt: asNullableString(row.removed_at),
    lockedUntil: asNullableString(row.locked_until),
    securityVersion: asNumber(row.security_version),
  };
}

function invitationFromRow(row: Record<string, unknown>): TeamInvitation {
  return {
    id: asString(row.id),
    email: asString(row.email),
    role: validateRole(asString(row.role)),
    status: asString(row.status) as TeamInvitation["status"],
    createdAt: asString(row.created_at),
    expiresAt: asString(row.expires_at),
    acceptedAt: asNullableString(row.accepted_at),
    cancelledAt: asNullableString(row.cancelled_at),
    invitedBy: asNullableString(row.invited_by),
  };
}

function teamUserFromAuthUser(user: AuthUser, notificationRoutes: NotificationRoute[] = []): TeamUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    requireTwoFactorSetup: user.requireTwoFactorSetup,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
    invitedAt: user.invitedAt,
    lastLoginAt: user.lastLoginAt,
    disabledAt: user.disabledAt,
    notificationRoutes: normalizeNotificationRoutes(notificationRoutes),
  };
}

async function executeSchema(db: D1DatabaseBinding, sql: string) {
  try {
    await db.prepare(sql).run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/duplicate column name|already exists/i.test(message)) throw err;
  }
}

async function ensureAuthSchemaInner() {
  const db = await getD1();
  const statements = [
    `CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'removed')),
      password_hash TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      require_two_factor_setup INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT,
      totp_pending_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      security_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      invited_at TEXT,
      last_login_at TEXT,
      disabled_at TEXT,
      removed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      security_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT,
      revoked_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS auth_invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      cancelled_at TEXT,
      invited_by TEXT,
      replaced_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS auth_password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      requested_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS auth_recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS auth_audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      actor_email TEXT,
      event TEXT NOT NULL,
      subject_user_id TEXT,
      subject_email TEXT,
      ip_hash TEXT,
      user_agent_hash TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS auth_notification_preferences (
      user_id TEXT NOT NULL,
      route TEXT NOT NULL CHECK (route IN ('mini', 'metals', 'custom', 'featured')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, route)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_invitations_email_status ON auth_invitations(email, status)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_password_resets_token_hash ON auth_password_resets(token_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_recovery_codes_user_id ON auth_recovery_codes(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON auth_audit_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_notification_preferences_route ON auth_notification_preferences(route)`,
  ];

  for (const statement of statements) await executeSchema(db, statement);

  const alterStatements = [
    `ALTER TABLE auth_users ADD COLUMN totp_pending_secret TEXT`,
    `ALTER TABLE auth_users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE auth_users ADD COLUMN locked_until TEXT`,
    `ALTER TABLE auth_users ADD COLUMN security_version INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE auth_users ADD COLUMN require_two_factor_setup INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE auth_sessions ADD COLUMN security_version INTEGER NOT NULL DEFAULT 0`,
  ];

  for (const statement of alterStatements) await executeSchema(db, statement);

  const row = await db.prepare("SELECT COUNT(*) AS count FROM auth_users").first<{ count: number }>();
  if (Number(row?.count ?? 0) === 0) {
    const createdAt = nowIso();
    await db
      .prepare(
        `INSERT INTO auth_users
          (id, email, name, role, status, password_hash, must_change_password, created_at, updated_at, security_version)
         VALUES (?, ?, ?, 'admin', 'active', ?, 1, ?, ?, 0)`
      )
      .bind(
        randomId("usr"),
        INITIAL_ADMIN_EMAIL,
        "Administrator",
        INITIAL_ADMIN_PASSWORD_HASH,
        createdAt,
        createdAt
      )
      .run();
  }
}

export async function ensureAuthSchema() {
  if (!schemaReady) {
    schemaReady = ensureAuthSchemaInner().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function getUserRowByEmail(db: D1DatabaseBinding, email: string) {
  return db
    .prepare("SELECT * FROM auth_users WHERE email = ? AND status != 'removed' LIMIT 1")
    .bind(normalizeEmail(email))
    .first<Record<string, unknown>>();
}

async function getUserRowById(db: D1DatabaseBinding, userId: string) {
  return db
    .prepare("SELECT * FROM auth_users WHERE id = ? AND status != 'removed' LIMIT 1")
    .bind(userId)
    .first<Record<string, unknown>>();
}

export async function getUserById(userId: string) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, userId);
  return row ? userFromRow(row) : null;
}

export async function getUserByEmail(email: string) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowByEmail(db, email);
  return row ? userFromRow(row) : null;
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function createSession(user: Pick<AuthUser, "id" | "securityVersion">) {
  await ensureAuthSchema();
  const db = await getD1();
  const token = randomToken();
  const expiresAt = addSeconds(SESSION_MAX_AGE_SECONDS);
  await db
    .prepare(
      `INSERT INTO auth_sessions
        (id, user_id, token_hash, security_version, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(randomId("ses"), user.id, hashToken(token), user.securityVersion, nowIso(), expiresAt)
    .run();
  return { token, expiresAt };
}

async function getCurrentSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || "";
}

async function revokeSessionToken(rawToken: string) {
  if (!rawToken) return;
  await ensureAuthSchema();
  const db = await getD1();
  await db
    .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(nowIso(), hashToken(rawToken))
    .run();
}

export async function revokeCurrentSession() {
  await revokeSessionToken(await getCurrentSessionToken());
}

async function getCurrentSession() {
  const rawToken = await getCurrentSessionToken();
  if (!rawToken) return null;

  await ensureAuthSchema();
  const db = await getD1();
  const tokenHash = hashToken(rawToken);
  const row = await db
    .prepare(
      `SELECT
        s.id AS session_id,
        s.expires_at AS session_expires_at,
        s.revoked_at AS session_revoked_at,
        s.security_version AS session_security_version,
        u.*
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.token_hash = ?
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const user = userFromRow(row);
  const revokedAt = asNullableString(row.session_revoked_at);
  const expiresAt = asString(row.session_expires_at);
  const sessionVersion = asNumber(row.session_security_version);
  const expired = !expiresAt || Date.parse(expiresAt) <= Date.now();
  const invalidUser =
    user.status !== "active" || user.securityVersion !== sessionVersion || Boolean(revokedAt);

  if (expired || invalidUser) {
    await revokeSessionToken(rawToken);
    return null;
  }

  const refreshedExpiresAt = addSeconds(SESSION_MAX_AGE_SECONDS);
  await db
    .prepare("UPDATE auth_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?")
    .bind(nowIso(), refreshedExpiresAt, asString(row.session_id))
    .run();

  return {
    id: asString(row.session_id),
    user,
    expiresAt: refreshedExpiresAt,
    tokenHash,
  } satisfies AuthSession;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function isLoggedIn(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

export async function requireLogin(options: { role?: AuthRole } = {}): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (options.role === "admin" && user.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }
  return null;
}

export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required.", { status: 401, code: "unauthenticated" });
  if (user.role !== "admin") {
    throw new AuthError("Administrator access required.", { status: 403, code: "forbidden" });
  }
  return user;
}

export function safeDashboardRedirect(input: unknown, fallback = "/dashboard") {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (!trimmed.startsWith("/dashboard")) return fallback;
  if (trimmed.startsWith("/dashboard/login")) return fallback;
  return trimmed;
}

export function loginUrlFor(nextPath: string) {
  const safe = safeDashboardRedirect(nextPath, "/dashboard");
  return `/dashboard/login?next=${encodeURIComponent(safe)}`;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const host = request.headers.get("host");
  if (!host) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (originHost !== host) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }
  return null;
}

async function requestHashes(request?: Request) {
  const h = request ? request.headers : await headers();
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  const userAgent = h.get("user-agent") || "";

  return {
    ipHash: ip ? sha256(ip) : null,
    userAgentHash: userAgent ? sha256(userAgent) : null,
  };
}

export async function recordAuditEvent(input: {
  actor?: AuditActor;
  event: string;
  subjectUserId?: string | null;
  subjectEmail?: string | null;
  request?: Request;
  metadata?: Record<string, unknown>;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const hashes = await requestHashes(input.request);
  await db
    .prepare(
      `INSERT INTO auth_audit_log
        (id, actor_user_id, actor_email, event, subject_user_id, subject_email, ip_hash, user_agent_hash, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      randomId("aud"),
      input.actor?.id ?? null,
      input.actor?.email ?? null,
      input.event,
      input.subjectUserId ?? null,
      input.subjectEmail ? normalizeEmail(input.subjectEmail) : null,
      hashes.ipHash,
      hashes.userAgentHash,
      input.metadata ? JSON.stringify(input.metadata) : null,
      nowIso()
    )
    .run();
}

export async function verifyLoginPassword(email: string, password: string, request?: Request) {
  await ensureAuthSchema();
  const db = await getD1();
  const userRow = await getUserRowByEmail(db, email);
  if (!userRow) {
    await recordAuditEvent({ actor: null, event: "login_failed_unknown_email", request });
    return { ok: false as const, code: "invalid" };
  }

  const user = userFromRow(userRow);
  if (user.status !== "active") {
    await recordAuditEvent({
      actor: null,
      event: "login_failed_disabled",
      subjectUserId: user.id,
      subjectEmail: user.email,
      request,
    });
    return { ok: false as const, code: "invalid" };
  }

  if (user.lockedUntil && Date.parse(user.lockedUntil) > Date.now()) {
    await recordAuditEvent({
      actor: null,
      event: "login_failed_locked",
      subjectUserId: user.id,
      subjectEmail: user.email,
      request,
    });
    return { ok: false as const, code: "locked" };
  }

  const valid = await verifyPassword(password, asString(userRow.password_hash));
  if (!valid) {
    const failedCount = asNumber(userRow.failed_login_count) + 1;
    const lockedUntil = failedCount >= 10 ? addSeconds(15 * 60) : null;
    await db
      .prepare("UPDATE auth_users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?")
      .bind(lockedUntil ? 10 : failedCount, lockedUntil, nowIso(), user.id)
      .run();
    await recordAuditEvent({
      actor: null,
      event: lockedUntil ? "login_locked" : "login_failed_password",
      subjectUserId: user.id,
      subjectEmail: user.email,
      request,
    });
    return { ok: false as const, code: lockedUntil ? "locked" : "invalid" };
  }

  return {
    ok: true as const,
    user,
    passwordHash: asString(userRow.password_hash),
    totpSecret: asNullableString(userRow.totp_secret),
  };
}

export async function finishSuccessfulLogin(user: AuthUser, request?: Request) {
  await ensureAuthSchema();
  const db = await getD1();
  const refreshed = await getUserRowById(db, user.id);
  if (!refreshed) throw new AuthError("Account not found.", { status: 401, code: "not_found" });
  const currentUser = userFromRow(refreshed);
  const session = await createSession(currentUser);
  await db
    .prepare(
      "UPDATE auth_users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?"
    )
    .bind(nowIso(), nowIso(), currentUser.id)
    .run();
  await recordAuditEvent({
    actor: currentUser,
    event: "login_success",
    subjectUserId: currentUser.id,
    subjectEmail: currentUser.email,
    request,
  });
  return { user: currentUser, session };
}

async function assertNotFinalAdmin(db: D1DatabaseBinding, targetUserId: string) {
  const target = await getUserRowById(db, targetUserId);
  if (!target) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const targetUser = userFromRow(target);
  if (targetUser.role !== "admin" || targetUser.status !== "active") return targetUser;

  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM auth_users WHERE role = 'admin' AND status = 'active'")
    .first<{ count: number }>();
  if (Number(countRow?.count ?? 0) <= 1) {
    throw new AuthError("You cannot remove, disable or demote the final administrator.", {
      status: 409,
      code: "final_admin",
    });
  }
  return targetUser;
}

export async function listTeam() {
  await ensureAuthSchema();
  const db = await getD1();
  await expireOldInvitations(db);

  const usersRows = await db
    .prepare(
      `SELECT * FROM auth_users
       WHERE status != 'removed'
       ORDER BY created_at ASC, email ASC`
    )
    .all<Record<string, unknown>>();
  const invitationRows = await db
    .prepare(
      `SELECT * FROM auth_invitations
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    )
    .all<Record<string, unknown>>();
  const preferenceRows = await db
    .prepare(
      `SELECT user_id, route
       FROM auth_notification_preferences
       ORDER BY route ASC`
    )
    .all<Record<string, unknown>>();
  const routesByUser = new Map<string, NotificationRoute[]>();
  for (const row of preferenceRows.results || []) {
    const userId = asString(row.user_id);
    const route = validateNotificationRoute(asString(row.route));
    routesByUser.set(userId, [...(routesByUser.get(userId) || []), route]);
  }

  return {
    users: (usersRows.results || []).map((row) => {
      const user = userFromRow(row);
      return teamUserFromAuthUser(user, routesByUser.get(user.id) || []);
    }),
    invitations: (invitationRows.results || []).map(invitationFromRow),
  };
}

export async function updateTeamUserNotificationRoutes(input: {
  userId: string;
  routes: unknown;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.userId);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const user = userFromRow(row);
  const routes = normalizeNotificationRoutes(input.routes);
  const createdAt = nowIso();

  await db.prepare("DELETE FROM auth_notification_preferences WHERE user_id = ?").bind(user.id).run();
  for (const route of routes) {
    await db
      .prepare(
        `INSERT INTO auth_notification_preferences
          (user_id, route, created_at)
         VALUES (?, ?, ?)`
      )
      .bind(user.id, route, createdAt)
      .run();
  }

  await recordAuditEvent({
    actor: input.actor,
    event: "team_user_notifications_changed",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
    metadata: { routes },
  });
}

export async function teamNotificationRecipientsForRoute(route: NotificationRoute) {
  await ensureAuthSchema();
  const db = await getD1();
  const cleanRoute = validateNotificationRoute(route);
  const rows = await db
    .prepare(
      `SELECT DISTINCT u.email
       FROM auth_notification_preferences p
       JOIN auth_users u ON u.id = p.user_id
       WHERE p.route = ?
         AND u.status = 'active'
       ORDER BY u.email ASC`
    )
    .bind(cleanRoute)
    .all<{ email: string }>();

  return Array.from(
    new Set(
      (rows.results || [])
        .map((row) => normalizeEmail(row.email))
        .filter((email) => isValidEmail(email))
    )
  );
}

export async function listAuditEvents(limit = 25) {
  await ensureAuthSchema();
  const db = await getD1();
  const rows = await db
    .prepare(
      `SELECT id, actor_email, event, subject_email, created_at
       FROM auth_audit_log
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(Math.min(Math.max(limit, 1), 100))
    .all<Record<string, unknown>>();
  return (rows.results || []).map((row) => ({
    id: asString(row.id),
    actorEmail: asNullableString(row.actor_email),
    event: asString(row.event),
    subjectEmail: asNullableString(row.subject_email),
    createdAt: asString(row.created_at),
  })) satisfies AuditLogRow[];
}

async function expireOldInvitations(db: D1DatabaseBinding) {
  await db
    .prepare("UPDATE auth_invitations SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?")
    .bind(nowIso())
    .run();
}

async function expireOldPasswordResets(db: D1DatabaseBinding) {
  await db
    .prepare("UPDATE auth_password_resets SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?")
    .bind(nowIso())
    .run();
}

export async function createTeamInvitation(input: {
  email: string;
  role: AuthRole;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new AuthError("Enter a valid email address.", { code: "invalid_email" });
  }

  const role = validateRole(input.role);
  const existingUser = await getUserRowByEmail(db, email);
  if (existingUser) {
    throw new AuthError("That email is already on the team.", { code: "duplicate_user" });
  }

  await expireOldInvitations(db);
  const existingInvite = await db
    .prepare("SELECT id FROM auth_invitations WHERE email = ? AND status = 'pending' LIMIT 1")
    .bind(email)
    .first<{ id: string }>();
  if (existingInvite) {
    throw new AuthError("That email already has a pending invitation.", { code: "duplicate_invite" });
  }

  const token = randomToken();
  const createdAt = nowIso();
  const invitation = {
    id: randomId("inv"),
    email,
    role,
    status: "pending" as const,
    createdAt,
    expiresAt: addHours(72),
    acceptedAt: null,
    cancelledAt: null,
    invitedBy: input.actor.id,
  };

  await db
    .prepare(
      `INSERT INTO auth_invitations
        (id, email, role, token_hash, status, created_at, expires_at, invited_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .bind(invitation.id, email, role, hashToken(token), createdAt, invitation.expiresAt, input.actor.id)
    .run();

  await recordAuditEvent({
    actor: input.actor,
    event: "team_invitation_created",
    subjectEmail: email,
    request: input.request,
    metadata: { role },
  });

  return { invitation, token };
}

export async function resendTeamInvitation(input: {
  invitationId: string;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  await expireOldInvitations(db);
  const row = await db
    .prepare("SELECT * FROM auth_invitations WHERE id = ? LIMIT 1")
    .bind(input.invitationId)
    .first<Record<string, unknown>>();
  if (!row || asString(row.status) !== "pending") {
    throw new AuthError("That invitation is no longer pending.", { status: 404, code: "invite_not_pending" });
  }

  const token = randomToken();
  const expiresAt = addHours(72);
  await db
    .prepare("UPDATE auth_invitations SET token_hash = ?, expires_at = ? WHERE id = ?")
    .bind(hashToken(token), expiresAt, input.invitationId)
    .run();

  const invitation = invitationFromRow({ ...row, expires_at: expiresAt });
  await recordAuditEvent({
    actor: input.actor,
    event: "team_invitation_resent",
    subjectEmail: invitation.email,
    request: input.request,
    metadata: { role: invitation.role },
  });
  return { invitation, token };
}

export async function cancelTeamInvitation(input: {
  invitationId: string;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await db
    .prepare("SELECT * FROM auth_invitations WHERE id = ? LIMIT 1")
    .bind(input.invitationId)
    .first<Record<string, unknown>>();
  if (!row || asString(row.status) !== "pending") {
    throw new AuthError("That invitation is no longer pending.", { status: 404, code: "invite_not_pending" });
  }

  await db
    .prepare("UPDATE auth_invitations SET status = 'cancelled', cancelled_at = ? WHERE id = ?")
    .bind(nowIso(), input.invitationId)
    .run();
  await recordAuditEvent({
    actor: input.actor,
    event: "team_invitation_cancelled",
    subjectEmail: asString(row.email),
    request: input.request,
  });
}

export async function getInvitationByToken(token: string) {
  await ensureAuthSchema();
  const db = await getD1();
  await expireOldInvitations(db);
  const row = await db
    .prepare("SELECT * FROM auth_invitations WHERE token_hash = ? LIMIT 1")
    .bind(hashToken(token))
    .first<Record<string, unknown>>();
  if (!row) return null;
  return invitationFromRow(row);
}

export async function acceptTeamInvitation(input: {
  token: string;
  name: string;
  password: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  await expireOldInvitations(db);
  const row = await db
    .prepare("SELECT * FROM auth_invitations WHERE token_hash = ? LIMIT 1")
    .bind(hashToken(input.token))
    .first<Record<string, unknown>>();
  if (!row || asString(row.status) !== "pending") {
    throw new AuthError("This invitation link is invalid or has expired.", {
      status: 410,
      code: "invalid_invite",
    });
  }

  const invitation = invitationFromRow(row);
  const existingUser = await getUserRowByEmail(db, invitation.email);
  if (existingUser) {
    await db
      .prepare("UPDATE auth_invitations SET status = 'accepted', accepted_at = ? WHERE id = ?")
      .bind(nowIso(), invitation.id)
      .run();
    throw new AuthError("This email already has dashboard access. Sign in instead.", {
      status: 409,
      code: "existing_user",
    });
  }

  const name = input.name.trim();
  if (name.length < 2) throw new AuthError("Enter your name.", { code: "missing_name" });

  const passwordErrors = passwordPolicyErrors(input.password, invitation.email);
  if (passwordErrors.length) {
    throw new AuthError(passwordErrors.join(" "), { code: "weak_password" });
  }

  const userId = randomId("usr");
  const createdAt = nowIso();
  const passwordHash = await hashPassword(input.password);
  await db
    .prepare(
      `INSERT INTO auth_users
        (id, email, name, role, status, password_hash, must_change_password, created_at, updated_at, invited_at)
       VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?, ?)`
    )
    .bind(userId, invitation.email, name, invitation.role, passwordHash, createdAt, createdAt, invitation.createdAt)
    .run();
  await db
    .prepare("UPDATE auth_invitations SET status = 'accepted', accepted_at = ? WHERE id = ?")
    .bind(createdAt, invitation.id)
    .run();

  const user = userFromRow((await getUserRowById(db, userId))!);
  await recordAuditEvent({
    actor: null,
    event: "team_invitation_accepted",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
    metadata: { role: user.role },
  });
  return user;
}

export async function updateTeamUserRole(input: {
  userId: string;
  role: AuthRole;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const role = validateRole(input.role);
  const current = await getUserRowById(db, input.userId);
  if (!current) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const user = userFromRow(current);
  if (user.role === "admin" && role !== "admin") await assertNotFinalAdmin(db, input.userId);

  await db
    .prepare("UPDATE auth_users SET role = ?, security_version = security_version + 1, updated_at = ? WHERE id = ?")
    .bind(role, nowIso(), input.userId)
    .run();
  await revokeUserSessions(input.userId);
  await recordAuditEvent({
    actor: input.actor,
    event: "team_user_role_changed",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
    metadata: { from: user.role, to: role },
  });
}

export async function disableTeamUser(input: {
  userId: string;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const user = await assertNotFinalAdmin(db, input.userId);
  if (user.status === "disabled") return;

  await db
    .prepare(
      `UPDATE auth_users
       SET status = 'disabled', disabled_at = ?, security_version = security_version + 1, updated_at = ?
       WHERE id = ?`
    )
    .bind(nowIso(), nowIso(), input.userId)
    .run();
  await revokeUserSessions(input.userId);
  await recordAuditEvent({
    actor: input.actor,
    event: "team_user_disabled",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
  });
}

export async function enableTeamUser(input: {
  userId: string;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.userId);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const user = userFromRow(row);
  await db
    .prepare(
      `UPDATE auth_users
       SET status = 'active', disabled_at = NULL, security_version = security_version + 1, updated_at = ?
       WHERE id = ?`
    )
    .bind(nowIso(), input.userId)
    .run();
  await recordAuditEvent({
    actor: input.actor,
    event: "team_user_enabled",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
  });
}

export async function setTeamUserTwoFactorRequirement(input: {
  userId: string;
  required: boolean;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.userId);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const user = userFromRow(row);
  if (user.status !== "active") {
    throw new AuthError("Only active users can be changed.", { status: 409, code: "inactive_user" });
  }

  await db
    .prepare("UPDATE auth_users SET require_two_factor_setup = ?, updated_at = ? WHERE id = ?")
    .bind(input.required ? 1 : 0, nowIso(), user.id)
    .run();
  await recordAuditEvent({
    actor: input.actor,
    event: input.required ? "team_user_two_factor_required" : "team_user_two_factor_requirement_removed",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
  });
}

export async function disableTeamUserTwoFactor(input: {
  userId: string;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.userId);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const user = userFromRow(row);
  if (user.id === input.actor.id) {
    throw new AuthError("Use Account Security to change your own 2FA.", {
      status: 409,
      code: "self_two_factor_change",
    });
  }
  if (!user.totpEnabled && !user.requireTwoFactorSetup) return;

  await db.prepare("DELETE FROM auth_recovery_codes WHERE user_id = ?").bind(user.id).run();
  await db
    .prepare(
      `UPDATE auth_users
       SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled = 0,
           require_two_factor_setup = 0, security_version = security_version + 1, updated_at = ?
       WHERE id = ?`
    )
    .bind(nowIso(), user.id)
    .run();
  await revokeUserSessions(user.id);
  await recordAuditEvent({
    actor: input.actor,
    event: "team_user_two_factor_disabled",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
  });
}

export async function removeTeamUser(input: {
  userId: string;
  actor: AuthUser;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const user = await assertNotFinalAdmin(db, input.userId);

  await revokeUserSessions(input.userId);
  await db.prepare("DELETE FROM auth_recovery_codes WHERE user_id = ?").bind(input.userId).run();
  await db.prepare("DELETE FROM auth_password_resets WHERE user_id = ?").bind(input.userId).run();
  await db.prepare("DELETE FROM auth_notification_preferences WHERE user_id = ?").bind(input.userId).run();
  await db.prepare("DELETE FROM auth_users WHERE id = ?").bind(input.userId).run();
  await recordAuditEvent({
    actor: input.actor,
    event: "team_user_removed",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
  });
}

async function revokeUserSessions(userId: string) {
  await ensureAuthSchema();
  const db = await getD1();
  await db
    .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .bind(nowIso(), userId)
    .run();
}

async function rotateUserSecurity(userId: string) {
  await ensureAuthSchema();
  const db = await getD1();
  await db
    .prepare("UPDATE auth_users SET security_version = security_version + 1, updated_at = ? WHERE id = ?")
    .bind(nowIso(), userId)
    .run();
  await revokeUserSessions(userId);
  const row = await getUserRowById(db, userId);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  return userFromRow(row);
}

export async function createPasswordReset(input: {
  email: string;
  requestedBy?: AuthUser | null;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  await expireOldPasswordResets(db);
  const row = await getUserRowByEmail(db, input.email);
  if (!row) return null;
  const user = userFromRow(row);
  if (user.status !== "active") return null;

  await db
    .prepare("UPDATE auth_password_resets SET status = 'expired' WHERE user_id = ? AND status = 'pending'")
    .bind(user.id)
    .run();

  const token = randomToken();
  const reset = {
    id: randomId("rst"),
    token,
    user,
    expiresAt: addHours(1),
  };

  await db
    .prepare(
      `INSERT INTO auth_password_resets
        (id, user_id, token_hash, status, created_at, expires_at, requested_by)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`
    )
    .bind(reset.id, user.id, hashToken(token), nowIso(), reset.expiresAt, input.requestedBy?.id ?? null)
    .run();

  await recordAuditEvent({
    actor: input.requestedBy ?? null,
    event: input.requestedBy ? "password_reset_admin_created" : "password_reset_requested",
    subjectUserId: user.id,
    subjectEmail: user.email,
    request: input.request,
  });

  return reset;
}

export async function getPasswordResetByToken(token: string) {
  await ensureAuthSchema();
  const db = await getD1();
  await expireOldPasswordResets(db);
  const row = await db
    .prepare(
      `SELECT r.*, u.email AS user_email
       FROM auth_password_resets r
       JOIN auth_users u ON u.id = r.user_id
       WHERE r.token_hash = ?
       LIMIT 1`
    )
    .bind(hashToken(token))
    .first<Record<string, unknown>>();
  if (!row || asString(row.status) !== "pending") return null;
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    email: asString(row.user_email),
    expiresAt: asString(row.expires_at),
  };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const reset = await getPasswordResetByToken(input.token);
  if (!reset) {
    throw new AuthError("This reset link is invalid or has expired.", {
      status: 410,
      code: "invalid_reset",
    });
  }

  const errors = passwordPolicyErrors(input.password, reset.email);
  if (errors.length) throw new AuthError(errors.join(" "), { code: "weak_password" });

  const passwordHash = await hashPassword(input.password);
  const usedAt = nowIso();
  await db
    .prepare(
      `UPDATE auth_users
       SET password_hash = ?, must_change_password = 0, failed_login_count = 0, locked_until = NULL,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(passwordHash, usedAt, reset.userId)
    .run();
  await db
    .prepare("UPDATE auth_password_resets SET status = 'used', used_at = ? WHERE id = ?")
    .bind(usedAt, reset.id)
    .run();
  await revokeUserSessions(reset.userId);
  await recordAuditEvent({
    actor: null,
    event: "password_reset_completed",
    subjectUserId: reset.userId,
    subjectEmail: reset.email,
    request: input.request,
  });
}

export async function changeOwnPassword(input: {
  user: AuthUser;
  currentPassword: string;
  newPassword: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.user.id);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const valid = await verifyPassword(input.currentPassword, asString(row.password_hash));
  if (!valid) throw new AuthError("The current password is incorrect.", { status: 401, code: "wrong_password" });

  const errors = passwordPolicyErrors(input.newPassword, input.user.email);
  if (errors.length) throw new AuthError(errors.join(" "), { code: "weak_password" });

  const passwordHash = await hashPassword(input.newPassword);
  await db
    .prepare(
      `UPDATE auth_users
       SET password_hash = ?, must_change_password = 0, failed_login_count = 0, locked_until = NULL,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(passwordHash, nowIso(), input.user.id)
    .run();

  const refreshedUser = await rotateUserSecurity(input.user.id);
  await recordAuditEvent({
    actor: refreshedUser,
    event: "password_changed",
    subjectUserId: refreshedUser.id,
    subjectEmail: refreshedUser.email,
    request: input.request,
  });
  return refreshedUser;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function createTotpSecret() {
  return base32Encode(nodeCrypto.randomBytes(20));
}

export function buildTotpUri(email: string, secret: string) {
  const label = encodeURIComponent(`M-Machine:${email}`);
  const issuer = encodeURIComponent("M-Machine");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function totpCode(secret: string, counter: number) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = nodeCrypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (let offset = -window; offset <= window; offset += 1) {
    if (totpCode(secret, counter + offset) === clean) return true;
  }
  return false;
}

function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function recoveryCodeHash(code: string) {
  return sha256(normalizeRecoveryCode(code));
}

function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 12 }, () => alphabet[nodeCrypto.randomInt(0, alphabet.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

async function replaceRecoveryCodes(db: D1DatabaseBinding, userId: string) {
  const codes = Array.from({ length: 10 }, generateRecoveryCode);
  await db.prepare("DELETE FROM auth_recovery_codes WHERE user_id = ?").bind(userId).run();
  for (const code of codes) {
    await db
      .prepare("INSERT INTO auth_recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)")
      .bind(randomId("rec"), userId, recoveryCodeHash(code), nowIso())
      .run();
  }
  return codes;
}

export async function startTwoFactorSetup(input: {
  user: AuthUser;
  currentPassword: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.user.id);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const valid = await verifyPassword(input.currentPassword, asString(row.password_hash));
  if (!valid) throw new AuthError("The current password is incorrect.", { status: 401, code: "wrong_password" });

  const secret = createTotpSecret();
  await db
    .prepare("UPDATE auth_users SET totp_pending_secret = ?, updated_at = ? WHERE id = ?")
    .bind(secret, nowIso(), input.user.id)
    .run();
  await recordAuditEvent({
    actor: input.user,
    event: "two_factor_setup_started",
    subjectUserId: input.user.id,
    subjectEmail: input.user.email,
    request: input.request,
  });
  return { secret, otpauthUrl: buildTotpUri(input.user.email, secret) };
}

export async function confirmTwoFactorSetup(input: {
  user: AuthUser;
  code: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.user.id);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const pendingSecret = asNullableString(row.totp_pending_secret);
  if (!pendingSecret) throw new AuthError("Start 2FA setup first.", { code: "missing_pending_totp" });
  if (!verifyTotpCode(pendingSecret, input.code)) {
    throw new AuthError("Enter the current 6-digit code from your authenticator app.", {
      code: "invalid_totp",
    });
  }

  const codes = await replaceRecoveryCodes(db, input.user.id);
  await db
    .prepare(
      `UPDATE auth_users
       SET totp_secret = ?, totp_pending_secret = NULL, totp_enabled = 1,
           require_two_factor_setup = 0, updated_at = ?
       WHERE id = ?`
    )
    .bind(pendingSecret, nowIso(), input.user.id)
    .run();
  const refreshedUser = await rotateUserSecurity(input.user.id);
  await recordAuditEvent({
    actor: refreshedUser,
    event: "two_factor_enabled",
    subjectUserId: refreshedUser.id,
    subjectEmail: refreshedUser.email,
    request: input.request,
  });
  return { user: refreshedUser, recoveryCodes: codes };
}

export async function disableTwoFactor(input: {
  user: AuthUser;
  currentPassword: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.user.id);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const valid = await verifyPassword(input.currentPassword, asString(row.password_hash));
  if (!valid) throw new AuthError("The current password is incorrect.", { status: 401, code: "wrong_password" });

  await db.prepare("DELETE FROM auth_recovery_codes WHERE user_id = ?").bind(input.user.id).run();
  await db
    .prepare(
      `UPDATE auth_users
       SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled = 0,
           require_two_factor_setup = 0, updated_at = ?
       WHERE id = ?`
    )
    .bind(nowIso(), input.user.id)
    .run();
  const refreshedUser = await rotateUserSecurity(input.user.id);
  await recordAuditEvent({
    actor: refreshedUser,
    event: "two_factor_disabled",
    subjectUserId: refreshedUser.id,
    subjectEmail: refreshedUser.email,
    request: input.request,
  });
  return refreshedUser;
}

export async function regenerateRecoveryCodes(input: {
  user: AuthUser;
  currentPassword: string;
  request?: Request;
}) {
  await ensureAuthSchema();
  const db = await getD1();
  const row = await getUserRowById(db, input.user.id);
  if (!row) throw new AuthError("User not found.", { status: 404, code: "not_found" });
  const valid = await verifyPassword(input.currentPassword, asString(row.password_hash));
  if (!valid) throw new AuthError("The current password is incorrect.", { status: 401, code: "wrong_password" });
  if (!boolFromDb(row.totp_enabled)) throw new AuthError("2FA is not enabled.", { code: "totp_not_enabled" });

  const codes = await replaceRecoveryCodes(db, input.user.id);
  await recordAuditEvent({
    actor: input.user,
    event: "two_factor_recovery_codes_regenerated",
    subjectUserId: input.user.id,
    subjectEmail: input.user.email,
    request: input.request,
  });
  return codes;
}

export async function verifyRecoveryCode(userId: string, code: string) {
  await ensureAuthSchema();
  const db = await getD1();
  const cleanHash = recoveryCodeHash(code);
  const row = await db
    .prepare(
      "SELECT id FROM auth_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1"
    )
    .bind(userId, cleanHash)
    .first<{ id: string }>();
  if (!row) return false;
  await db
    .prepare("UPDATE auth_recovery_codes SET used_at = ? WHERE id = ?")
    .bind(nowIso(), row.id)
    .run();
  return true;
}

export async function makeSessionToken(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Cannot create a session without a user.");
  const session = await createSession(user);
  return session.token;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  await ensureAuthSchema();
  const db = await getD1();
  const row = await db
    .prepare(
      `SELECT s.revoked_at, s.expires_at, s.security_version, u.status, u.security_version AS user_security_version
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.token_hash = ?
       LIMIT 1`
    )
    .bind(hashToken(token))
    .first<Record<string, unknown>>();
  if (!row) return false;
  return (
    !asNullableString(row.revoked_at) &&
    Date.parse(asString(row.expires_at)) > Date.now() &&
    asString(row.status) === "active" &&
    asNumber(row.security_version) === asNumber(row.user_security_version)
  );
}
