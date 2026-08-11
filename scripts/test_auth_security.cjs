const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("lib/auth.ts");
const authRoute = read("app/api/auth/route.ts");
const teamRoute = read("app/api/team/route.ts");
const quoteRequestRoute = read("app/api/quote-requests/route.ts");
const securityRoute = read("app/api/auth/security/route.ts");
const forgotPasswordForm = read("app/dashboard/forgot-password/ForgotPasswordForm.tsx");
const dashboardNav = read("app/dashboard/(protected)/DashboardNav.tsx");
const dashboardLiveUpdates = read("app/dashboard/(protected)/DashboardLiveUpdates.tsx");
const teamClient = read("app/dashboard/(protected)/team/TeamClient.tsx");
const dashboardLayout = read("app/dashboard/(protected)/layout.tsx");
const ordersClient = read("app/dashboard/(protected)/orders/OrdersClient.tsx");
const loginForm = read("app/dashboard/login/LoginForm.tsx");
const acceptInvitationForm = read("app/dashboard/accept-invitation/[token]/AcceptInvitationForm.tsx");
const resetPasswordForm = read("app/dashboard/reset-password/[token]/ResetPasswordForm.tsx");
const uploadToken = read("lib/quote-upload-token.ts");
const middleware = read("middleware.ts");
const migration = read("migrations/0005_team_auth.sql");
const notificationMigration = read("migrations/0006_team_notification_preferences.sql");
const twoFactorMigration = read("migrations/0007_team_two_factor_requirement.sql");

for (const file of [
  "lib/auth.ts",
  "app/api/auth/route.ts",
  "app/api/team/route.ts",
  "app/api/auth/security/route.ts",
  "migrations/0005_team_auth.sql",
  "migrations/0006_team_notification_preferences.sql",
  "migrations/0007_team_two_factor_requirement.sql",
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
assert.match(notificationMigration, /auth_notification_preferences/, "team notification preference migration must exist");
assert.match(twoFactorMigration, /require_two_factor_setup/, "team 2FA requirement migration must exist");

assert.match(authRoute, /verifyLoginPassword/, "login must use DB-backed password verification");
assert.match(authRoute, /verifyTotpCode/, "login must support TOTP verification");
assert.match(authRoute, /verifyRecoveryCode/, "login must support recovery codes");
assert.match(authRoute, /requireSameOrigin/, "login mutations must check origin");
assert.match(teamRoute, /requireAdminUser/, "team API must require administrator access");
assert.match(teamRoute, /updateTeamUserNotificationRoutes/, "team API must update notification preferences");
assert.doesNotMatch(teamRoute, /setTeamUserTwoFactorRequirement/, "team API must not let admins manage another user's 2FA setup");
assert.doesNotMatch(teamRoute, /disableTeamUserTwoFactor/, "team API must not let admins disable another user's 2FA");
assert.match(securityRoute, /QRCode/, "2FA setup must generate a QR code");
assert.match(middleware, /next/, "dashboard middleware must preserve a next destination");
assert.match(middleware, /runtime = "experimental-edge"/, "dashboard middleware must use the edge runtime");
assert.match(middleware, /AUTH_SESSION_MAX_AGE_SECONDS = 400 \* 24 \* 60 \* 60/, "dashboard session cookie should stay long-lived");
assert.match(auth, /teamNotificationRecipientsForRoute/, "team notification recipients must be available to email routing");
assert.match(auth, /DELETE FROM auth_sessions WHERE user_id/, "removed team users must have sessions hard-deleted");
assert.match(auth, /DELETE FROM auth_invitations WHERE email/, "removed team users must not leave invite records that can conflict");
assert.match(auth, /DELETE FROM auth_audit_log[\s\S]+actor_user_id[\s\S]+subject_user_id/, "removed team users must be cleared from audit records");
assert.match(forgotPasswordForm, /const form = e\.currentTarget[\s\S]+new FormData\(form\)[\s\S]+form\.reset\(\)/, "forgot password form must keep a stable form reference across await");
assert.doesNotMatch(forgotPasswordForm, /e\.currentTarget\.reset\(\)/, "forgot password form must not reset through a stale event target");
assert.match(dashboardNav, /usePathname/, "dashboard nav must know the active route");
assert.match(dashboardNav, /bg-gold text-cream/, "dashboard nav active tab must use red brand highlighting");
assert.match(dashboardNav, /mmachine:quote-requests-updated/, "dashboard nav badge must listen for live quote request counts");
assert.match(dashboardLiveUpdates, /LIVE_REFRESH_MS = 3000/, "dashboard live updates should poll frequently enough for new order visibility");
assert.match(dashboardLiveUpdates, /\/api\/quote-requests\?live=1/, "dashboard live updates must poll active quote requests");
assert.match(dashboardLiveUpdates, /router\.refresh\(\)/, "dashboard overview should refresh when active quote requests change");
assert.match(dashboardLayout, /<DashboardLiveUpdates \/>/, "protected dashboard layout must mount the live quote updater");
assert.match(ordersClient, /mmachine:quote-requests-updated/, "orders tab must merge live quote request updates");
assert.match(ordersClient, /mergeQuoteUpdates/, "orders tab must add newly seen quote cards without a manual refresh");
const saveNoEmailStart = quoteRequestRoute.indexOf("if (body.saveNoEmail && !body.emailCustomer)");
const customerEmailStart = quoteRequestRoute.indexOf("let customerEmailSent = false");
assert.ok(saveNoEmailStart >= 0 && customerEmailStart > saveNoEmailStart, "save-no-email must be handled before customer email sending");
const saveNoEmailSection = quoteRequestRoute.slice(saveNoEmailStart, customerEmailStart);
assert.doesNotMatch(saveNoEmailSection, /sendQuoteEmail/, "save-no-email must not send a customer email");
assert.doesNotMatch(saveNoEmailSection, /customerEmailSentAt\s*=/, "save-no-email must not mark a customer email as sent");
assert.match(teamClient, /Reset Password/, "team reset button must use clear password reset wording");
assert.doesNotMatch(teamClient, /Default fallback/, "team notification selector must not expose fallback copy");
assert.match(teamClient, /Order Notifications/, "team notification column must be labelled for order notifications");
assert.match(teamClient, /Managed by this user/, "team tab must explain that other users manage their own 2FA");
assert.doesNotMatch(teamClient, /Require 2FA/, "team tab must not expose a 2FA requirement button for other users");
assert.doesNotMatch(teamClient, /Turn off 2FA/, "team tab must not let admins turn off another user's 2FA");
assert.doesNotMatch(teamClient, /Required/, "team tab must not show admin-managed 2FA requirement state");
assert.doesNotMatch(dashboardLayout, /requireTwoFactorSetup[\s\S]+redirect/, "dashboard must not force 2FA setup from an admin-managed flag");
assert.match(loginForm, /autoComplete="username"/, "login email field must be saved as the password-manager username");
assert.match(acceptInvitationForm, /name="email"[\s\S]+autoComplete="username"/, "invite acceptance must save email as the password-manager username");
assert.match(resetPasswordForm, /name="email"[\s\S]+autoComplete="username"/, "password reset must save email as the password-manager username");
assert.match(loginForm, /window\.location\.assign/, "login should hard-navigate after setting the auth cookie");
assert.match(acceptInvitationForm, /window\.location\.assign/, "invite acceptance should hard-navigate after setting the auth cookie");
assert.doesNotMatch(loginForm, /router\.replace/, "login should not rely on client router navigation after auth");
assert.doesNotMatch(acceptInvitationForm, /router\.replace/, "invite acceptance should not rely on client router navigation after auth");
assert.equal(uploadToken.includes("OWNER_PASSWORD"), false, "upload tokens must not depend on OWNER_PASSWORD");

console.log("ok - dashboard auth security guardrails are present");
