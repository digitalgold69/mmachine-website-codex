import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { emailSetupStatus, sendQuoteEmail } from "@/lib/quote-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProbeRoute = "custom" | "mini" | "metals" | "featured" | "enquiry" | "fallback";

const PROBE_ROUTES = new Set<ProbeRoute>(["custom", "mini", "metals", "featured", "enquiry", "fallback"]);

function probeRoute(value: unknown): ProbeRoute {
  return typeof value === "string" && PROBE_ROUTES.has(value as ProbeRoute) ? (value as ProbeRoute) : "fallback";
}

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;

  return NextResponse.json(await emailSetupStatus());
}

export async function POST(request: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: { route?: unknown } = {};
  try {
    body = (await request.json()) as { route?: unknown };
  } catch {
    body = {};
  }

  const route = probeRoute(body.route);
  const setup = await emailSetupStatus();
  const routeRecipients = setup.recipients[route];
  const recipients = routeRecipients.length > 0 ? routeRecipients : setup.recipients.fallback;
  const sent = await sendQuoteEmail({
    to: recipients,
    subject: `M-Machine SES health check (${route})`,
    html: `
      <h2>M-Machine SES health check</h2>
      <p>This is a controlled owner-dashboard test for the ${route} notification route.</p>
      <p>Sent at ${new Date().toISOString()}.</p>
    `,
    replyTo: recipients[0],
  });

  return NextResponse.json({
    ok: sent.ok,
    route,
    recipients,
    fromEmailAddress: setup.fromEmailAddress,
    senderEmailAddress: setup.senderEmailAddress,
    result: sent,
  });
}
