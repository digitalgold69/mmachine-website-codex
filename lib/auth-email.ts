import { getCloudflareEnv, type MMachineCloudflareEnv } from "./cloudflare";
import { escapeHtml, sendQuoteEmail } from "./quote-email";

const DEFAULT_SITE_URL = "https://m-machine-metals.co.uk";

async function authSiteUrl() {
  const env: Partial<MMachineCloudflareEnv> = await getCloudflareEnv().catch(() => ({}));
  const configured =
    (typeof env.NEXT_PUBLIC_SITE_URL === "string" && env.NEXT_PUBLIC_SITE_URL) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL;

  try {
    const url = new URL(configured);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || isLocal) return url.origin;
  } catch {
    // Fall through to the production default.
  }

  return DEFAULT_SITE_URL;
}

async function dashboardUrl(path: string) {
  return new URL(path, await authSiteUrl()).toString();
}

function layout(title: string, body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f7f2e8;color:#0b3d2f;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2e8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #ded6c5;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0b3d2f;color:#fff;padding:18px 22px;">
                <div style="font-size:20px;font-weight:700;">${escapeHtml(title)}</div>
                <div style="font-size:13px;opacity:.82;margin-top:4px;">M-Machine dashboard</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 22px;font-size:16px;line-height:1.55;color:#2f261f;">
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string) {
  return `<p style="margin:22px 0 10px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#0b3d2f;color:#fff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700;">
      ${escapeHtml(label)}
    </a>
  </p>`;
}

export async function sendTeamInvitationEmail(input: {
  to: string;
  role: "admin" | "member";
  token: string;
}) {
  const acceptUrl = await dashboardUrl(`/dashboard/accept-invitation/${encodeURIComponent(input.token)}`);
  const loginUrl = await dashboardUrl("/dashboard/login");
  const roleLabel = input.role === "admin" ? "Administrator" : "Team Member";

  return sendQuoteEmail({
    to: input.to,
    subject: "Your M-Machine dashboard invitation",
    fromName: "M-Machine Dashboard",
    html: layout(
      "Dashboard invitation",
      `<p style="margin:0 0 14px;">You have been invited to join the M-Machine dashboard as <strong>${escapeHtml(
        roleLabel
      )}</strong>.</p>
       <p style="margin:0 0 14px;">This secure invitation expires in 72 hours and can only be used once.</p>
       ${button("Accept invitation", acceptUrl)}
       <p style="margin:20px 0 0;font-size:14px;color:#5b4c40;">Already accepted? <a href="${escapeHtml(
         loginUrl
       )}" style="color:#0b3d2f;">Sign in to the dashboard</a>.</p>`
    ),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  token: string;
  adminTriggered?: boolean;
}) {
  const resetUrl = await dashboardUrl(`/dashboard/reset-password/${encodeURIComponent(input.token)}`);
  return sendQuoteEmail({
    to: input.to,
    subject: input.adminTriggered ? "Reset your M-Machine dashboard password" : "M-Machine password reset",
    fromName: "M-Machine Dashboard",
    html: layout(
      "Password reset",
      `<p style="margin:0 0 14px;">${
        input.adminTriggered
          ? "An administrator has sent you a secure password reset link."
          : "We received a request to reset your dashboard password."
      }</p>
       <p style="margin:0 0 14px;">The link expires in 1 hour and can only be used once.</p>
       ${button("Reset password", resetUrl)}
       <p style="margin:20px 0 0;font-size:14px;color:#5b4c40;">If you did not expect this, you can ignore this email.</p>`
    ),
  });
}
