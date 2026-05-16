import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import {
  buildCustomerQuoteEmail,
  buildOwnerQuoteEmail,
  sendQuoteEmail,
} from "@/lib/quote-email";
import { getQuoteRequest, listQuoteRequests, saveQuoteRequest } from "@/lib/quotes";
import type { QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function asNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeItem(raw: Partial<QuoteItem>, index: number): QuoteItem {
  const qty = Math.max(1, Math.min(999, Math.floor(Number(raw.qty) || 1)));
  const catalogue = raw.catalogue === "metals" ? "metals" : "mini";
  const description = asString(raw.description, 1000);
  if (!description) throw new Error(`Item ${index + 1} is missing a description`);

  return {
    key: asString(raw.key, 120) || `${catalogue}-${Date.now()}-${index}`,
    catalogue,
    productId: asString(raw.productId, 120),
    code: asString(raw.code, 120),
    description,
    shape: asString(raw.shape, 120),
    metal: asString(raw.metal, 120),
    spec: asString(raw.spec, 120),
    size: asString(raw.size, 240),
    unit: asString(raw.unit, 120),
    qty,
    unitPriceExVat: asNumberOrNull(raw.unitPriceExVat),
    unitPriceIncVat: asNumberOrNull(raw.unitPriceIncVat),
  };
}

function safeStatus(value: unknown): QuoteStatus {
  return value === "reviewing" || value === "quoted" || value === "closed" ? value : "new";
}

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const quotes = await listQuoteRequests();
    return NextResponse.json({ quotes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: {
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      message?: string;
    };
    items?: Partial<QuoteItem>[];
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const customer = {
    name: asString(body.customer?.name, 160),
    email: asString(body.customer?.email, 220),
    phone: asString(body.customer?.phone, 80),
    company: asString(body.customer?.company, 180),
    message: asString(body.customer?.message, 2000),
  };

  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Quote request has no items" }, { status: 400 });
  }

  try {
    const items = rawItems.map(safeItem);
    const now = new Date().toISOString();
    const quote: QuoteRequest = {
      id: `Q-${Date.now().toString(36).toUpperCase()}`,
      submittedAt: now,
      updatedAt: now,
      status: "new",
      customer,
      items,
      ownerNotes: "",
      customerMessage: "",
      carriageExVat: null,
      extraChargesExVat: null,
      quotedAt: null,
      customerEmailSentAt: null,
      ownerEmailSentAt: null,
    };

    const ownerEmail = process.env.QUOTE_OWNER_EMAIL || "sales@m-machine.co.uk";
    const email = await sendQuoteEmail({
      to: ownerEmail,
      subject: `New M-Machine quote request ${quote.id}`,
      html: buildOwnerQuoteEmail(quote),
      replyTo: quote.customer.email,
    });
    if (email.ok) quote.ownerEmailSentAt = new Date().toISOString();

    const saved = await saveQuoteRequest(quote);
    return NextResponse.json({ ok: true, quoteId: saved.id, ownerEmailSent: email.ok });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: {
    id?: string;
    status?: QuoteStatus;
    items?: Partial<QuoteItem>[];
    ownerNotes?: string;
    customerMessage?: string;
    carriageExVat?: number | string | null;
    extraChargesExVat?: number | string | null;
    emailCustomer?: boolean;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

  try {
    const current = await getQuoteRequest(body.id);
    if (!current) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const next: QuoteRequest = {
      ...current,
      status: body.status ? safeStatus(body.status) : current.status,
      ownerNotes: asString(body.ownerNotes ?? current.ownerNotes, 3000),
      customerMessage: asString(body.customerMessage ?? current.customerMessage, 3000),
      carriageExVat: asNumberOrNull(body.carriageExVat),
      extraChargesExVat: asNumberOrNull(body.extraChargesExVat),
      updatedAt: new Date().toISOString(),
    };

    if (Array.isArray(body.items) && body.items.length > 0) {
      next.items = body.items.map(safeItem);
    }

    let customerEmailSent = false;
    if (body.emailCustomer) {
      const email = await sendQuoteEmail({
        to: next.customer.email,
        subject: `M-Machine quote ${next.id}`,
        html: buildCustomerQuoteEmail(next),
        replyTo: process.env.QUOTE_OWNER_EMAIL || "sales@m-machine.co.uk",
      });
      if (!email.ok) {
        return NextResponse.json(
          { error: email.error || "Customer email failed" },
          { status: 500 }
        );
      }
      next.status = "quoted";
      next.quotedAt = new Date().toISOString();
      next.customerEmailSentAt = new Date().toISOString();
      customerEmailSent = true;
    }

    const saved = await saveQuoteRequest(next);
    return NextResponse.json({ ok: true, quote: saved, customerEmailSent });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
