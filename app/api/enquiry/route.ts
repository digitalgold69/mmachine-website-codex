import { NextResponse } from "next/server";
import { buildOwnerEnquiryEmail, sendQuoteEmail } from "@/lib/quote-email";
import { checkRateLimit } from "@/lib/request-limits";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function trustedPageUrl(value: unknown) {
  const raw = text(value, 800);
  if (!raw) return "";
  try {
    const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://m-machine-metals.co.uk");
    const candidate = new URL(raw);
    return candidate.origin === expected.origin ? candidate.toString() : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "website-enquiry", 12, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages have been sent. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    if (text(body.website, 200)) return NextResponse.json({ ok: true });

    const enquiry = {
      name: text(body.name, 160),
      email: text(body.email, 220),
      phone: text(body.phone, 80),
      type: text(body.type, 100),
      message: text(body.message, 4000),
      product: text(body.product, 300),
      sku: text(body.sku, 120),
      category: text(body.category, 180),
      pageUrl: trustedPageUrl(body.pageUrl),
    };

    if (!enquiry.name || !enquiry.message || !EMAIL_PATTERN.test(enquiry.email)) {
      return NextResponse.json(
        { error: "Enter your name, a valid email address, and a message." },
        { status: 400 }
      );
    }

    const sent = await sendQuoteEmail({
      to: process.env.QUOTE_OWNER_EMAIL || "sales@m-machine.co.uk",
      subject: enquiry.product
        ? `M-Machine product enquiry: ${enquiry.product}`
        : `M-Machine website enquiry: ${enquiry.type || "General question"}`,
      html: buildOwnerEnquiryEmail(enquiry),
      replyTo: enquiry.email,
    });

    if (!sent.ok) {
      console.error("website_enquiry_email_failed", {
        skipped: sent.skipped,
        error: sent.error,
      });
      return NextResponse.json(
        { error: "Your message could not be sent just now. Please try again or call 01325 381302." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("website_enquiry_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { error: "Your message could not be sent just now. Please try again or call 01325 381302." },
      { status: 400 }
    );
  }
}
