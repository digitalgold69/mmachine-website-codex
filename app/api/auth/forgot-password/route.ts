import { NextResponse } from "next/server";
import { createPasswordReset, isValidEmail, requireSameOrigin } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/auth-email";
import { checkRateLimit } from "@/lib/request-limits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const rateLimit = await checkRateLimit(req, "forgot-password", 5, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: true, message: "If that email has dashboard access, a reset link will be sent." },
      { headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  if (isValidEmail(email)) {
    const reset = await createPasswordReset({ email, requestedBy: null, request: req });
    if (reset) {
      await sendPasswordResetEmail({ to: reset.user.email, token: reset.token });
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has dashboard access, a reset link will be sent.",
  });
}
