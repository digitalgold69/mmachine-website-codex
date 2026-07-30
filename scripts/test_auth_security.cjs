const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("lib/auth.ts");
const authRoute = read("app/api/auth/route.ts");
const teamRoute = read("app/api/team/route.ts");
const securityRoute = read("app/api/auth/security/route.ts");
const uploadToken = read("lib/quote-upload-token.ts");
const middleware = read("middleware.ts");
const migration = read("migrations/0005_team_auth.sql");

for (const file of [
  "lib/auth.ts",
  "app/api/auth/route.ts",
  "app/api/team/route.ts",
  "app/api/auth/security/route.ts",
  "migrations/0005_team_auth.sql",
]) {
  assert.doesNotMatch(read(file), /INITIAL_ADMIN_PASSWORD_HASH\s*=\s*["'](?!pbkdf2\$)/, `${file} must seed a hash`);
}

assert.match(auth, /INITIAL_ADMIN_EMAIL = "hodltid@icloud\.com"/, "initial admin email must be seeded");
assert.match(auth, /pbkdf2\$100000\$/, "initial password must be a derived hash");
assert.match(migration, /pbkdf2\$100000\$/, "migration must seed a derived password hash");
assert.match(migration, /auth_users/, "auth user table migration must exist");
assert.match(migration, /auth_sessions/, "auth sessions table migration must exist");
assert.match(migration, /auth_invitations/, "auth invitations table migration must exist");
assert.match(migration, /auth_password_resets/, "auth reset table migration must exist");
assert.match(migration, /auth_audit_log/, "auth audit table migration must exist");

assert.match(authRoute, /verifyLoginPassword/, "login must use DB-backed password verification");
assert.match(authRoute, /verifyTotpCode/, "login must support TOTP verification");
assert.match(authRoute, /verifyRecoveryCode/, "login must support recovery codes");
assert.match(authRoute, /requireSameOrigin/, "login mutations must check origin");
assert.match(teamRoute, /requireAdminUser/, "team API must require administrator access");
assert.match(securityRoute, /QRCode/, "2FA setup must generate a QR code");
assert.match(middleware, /next/, "dashboard middleware must preserve a next destination");
assert.match(middleware, /runtime = "experimental-edge"/, "dashboard middleware must use the edge runtime");
assert.equal(uploadToken.includes("OWNER_PASSWORD"), false, "upload tokens must not depend on OWNER_PASSWORD");

console.log("ok - dashboard auth security guardrails are present");
