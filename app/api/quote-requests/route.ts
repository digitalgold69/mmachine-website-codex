import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { getQuoteFilesBucket } from "@/lib/cloudflare";
import {
  buildCustomerInvoiceEmail,
  buildOwnerQuoteEmail,
  sendQuoteEmail,
} from "@/lib/quote-email";
import { getQuoteRequest, listQuoteRequests, saveQuoteRequest } from "@/lib/quotes";
import type { CustomQuoteDetails, QuoteFile, QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CUSTOM_FILE_EXTENSIONS = new Set(["dxf", "dwg", "ai", "eps", "step", "stp"]);
const MAX_CUSTOM_FILES = 10;
const MAX_CUSTOM_FILE_BYTES = 15 * 1024 * 1024;
const MAX_CUSTOM_TOTAL_BYTES = 60 * 1024 * 1024;

function asString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function asNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function asStringArray(values: unknown[], maxItems = 20, maxLength = 80) {
  return values
    .map((value) => asString(value, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeItem(raw: Partial<QuoteItem>, index: number): QuoteItem {
  const qty = Math.max(1, Math.min(999, Math.floor(Number(raw.qty) || 1)));
  const catalogue = raw.catalogue === "custom" ? "custom" : raw.catalogue === "metals" ? "metals" : "mini";
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
    custom: raw.custom,
  };
}

function safeStatus(value: unknown): QuoteStatus {
  if (value === "quoted" || value === "invoice_sent") return "invoice_sent";
  if (value === "reviewing" || value === "paid" || value === "closed") return value;
  return "new";
}

function quoteId(kind = "") {
  const prefix = kind ? `Q-${kind}` : "Q-";
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

function safeFileName(name: string) {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "drawing";
}

function fileExtension(name: string) {
  const match = safeFileName(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function customFileDownloadPath(key: string) {
  return `/api/quote-files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function storeCustomFiles(quoteIdValue: string, files: File[]): Promise<QuoteFile[]> {
  if (files.length === 0) return [];
  const bucket = await getQuoteFilesBucket();
  const savedFiles: QuoteFile[] = [];

  for (const file of files) {
    const cleanName = safeFileName(file.name);
    const ext = fileExtension(cleanName);
    const key = `quote-requests/${quoteIdValue}/${crypto.randomUUID()}-${cleanName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
    });

    savedFiles.push({
      key,
      name: cleanName,
      size: file.size,
      type: file.type || "application/octet-stream",
      extension: ext,
      uploadedAt: new Date().toISOString(),
    });
  }

  return savedFiles;
}

function validateCustomFiles(files: File[], drawingStatus: CustomQuoteDetails["drawingStatus"]) {
  if (files.length > MAX_CUSTOM_FILES) {
    throw new Error(`Upload up to ${MAX_CUSTOM_FILES} files at a time.`);
  }

  if (files.length === 0 && drawingStatus !== "help") {
    throw new Error("Upload a CAD file, or choose the option that you need help from a sketch or description.");
  }

  let total = 0;
  for (const file of files) {
    const ext = fileExtension(file.name);
    if (!CUSTOM_FILE_EXTENSIONS.has(ext)) {
      throw new Error("Accepted file types are DXF, DWG, AI, EPS, STEP and STP.");
    }
    if (file.size > MAX_CUSTOM_FILE_BYTES) {
      throw new Error(`${safeFileName(file.name)} is too large. Maximum file size is 15 MB.`);
    }
    total += file.size;
  }

  if (total > MAX_CUSTOM_TOTAL_BYTES) {
    throw new Error("The combined upload is too large. Please send up to 60 MB at a time.");
  }
}

function uploadedFilesFromForm(form: FormData) {
  return form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function createCustomQuote(req: Request) {
  const form = await req.formData();
  const drawingStatus = asString(form.get("drawingStatus"), 20) === "help" ? "help" : "cad";
  const files = uploadedFilesFromForm(form);
  validateCustomFiles(files, drawingStatus);

  const customer = {
    name: asString(form.get("name"), 160),
    email: asString(form.get("email"), 220),
    phone: asString(form.get("phone"), 80),
    company: asString(form.get("company"), 180),
    address: asString(form.get("address"), 1200),
    arrangeOwnDelivery: asBoolean(form.get("arrangeOwnDelivery")),
    message: asString(form.get("message"), 2400),
  };

  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }

  if (!customer.arrangeOwnDelivery && !customer.address) {
    return NextResponse.json(
      { error: "Delivery address is required unless you will arrange collection or delivery" },
      { status: 400 }
    );
  }

  const custom: CustomQuoteDetails = {
    projectName: asString(form.get("projectName"), 200),
    material: asString(form.get("material"), 160),
    thickness: asString(form.get("thickness"), 80),
    services: asStringArray(form.getAll("services")),
    finish: asString(form.get("finish"), 160),
    quantity: asString(form.get("quantity"), 80),
    units: asString(form.get("units"), 80),
    tolerance: asString(form.get("tolerance"), 160),
    deadline: asString(form.get("deadline"), 160),
    budget: asString(form.get("budget"), 100),
    drawingStatus,
  };

  if (!custom.projectName && !customer.message) {
    return NextResponse.json(
      { error: "Tell us what you need made before submitting the request." },
      { status: 400 }
    );
  }

  try {
    const now = new Date().toISOString();
    const id = quoteId("CF-");
    custom.files = await storeCustomFiles(id, files);

    const item: QuoteItem = {
      key: `custom-${id}`,
      catalogue: "custom",
      productId: id,
      code: "CUSTOM",
      description: custom.projectName || "Custom fabrication request",
      qty: Math.max(1, Math.min(999, Math.floor(Number(custom.quantity) || 1))),
      unit: custom.units || "job",
      unitPriceExVat: null,
      unitPriceIncVat: null,
      custom,
    };

    const quote: QuoteRequest = {
      id,
      submittedAt: now,
      updatedAt: now,
      status: "new",
      customer,
      items: [item],
      ownerNotes: "",
      customerMessage: "",
      carriageExVat: null,
      extraChargesExVat: null,
      quotedAt: null,
      invoiceSentAt: null,
      paidAt: null,
      customerEmailSentAt: null,
      ownerEmailSentAt: null,
    };

    const ownerEmail = process.env.QUOTE_OWNER_EMAIL || "sales@m-machine.co.uk";
    const email = await sendQuoteEmail({
      to: ownerEmail,
      subject: `New M-Machine custom fabrication request ${quote.id}`,
      html: buildOwnerQuoteEmail(quote),
      replyTo: quote.customer.email,
    });
    if (email.ok) quote.ownerEmailSentAt = new Date().toISOString();

    const saved = await saveQuoteRequest(quote);
    return NextResponse.json({
      ok: true,
      quoteId: saved.id,
      ownerEmailSent: email.ok,
      files: custom.files.map((file) => ({
        name: file.name,
        size: file.size,
        path: customFileDownloadPath(file.key),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Custom request could not be submitted. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const quotes = await listQuoteRequests();
    return NextResponse.json({ quotes });
  } catch (err) {
    return NextResponse.json(
      { error: "Orders could not be loaded. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return createCustomQuote(req);
  }

  let body: {
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      address?: string;
      arrangeOwnDelivery?: boolean;
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
    address: asString(body.customer?.address, 1200),
    arrangeOwnDelivery: body.customer?.arrangeOwnDelivery === true,
    message: asString(body.customer?.message, 2000),
  };

  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }

  if (!customer.arrangeOwnDelivery && !customer.address) {
    return NextResponse.json(
      { error: "Delivery address is required unless you will arrange collection or delivery" },
      { status: 400 }
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Quote request has no items" }, { status: 400 });
  }

  try {
    const items = rawItems.map(safeItem);
    const now = new Date().toISOString();
    const quote: QuoteRequest = {
      id: quoteId(),
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
      invoiceSentAt: null,
      paidAt: null,
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
    return NextResponse.json(
      { error: "Order request could not be submitted. Please try again or contact M-Machine." },
      { status: 500 }
    );
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
    markPaid?: boolean;
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

    if (next.status === "invoice_sent" && !next.invoiceSentAt) {
      next.invoiceSentAt = next.customerEmailSentAt || next.quotedAt || new Date().toISOString();
    }

    if (next.status === "paid" && !next.paidAt) {
      next.paidAt = new Date().toISOString();
    }

    let customerEmailSent = false;
    if (body.emailCustomer) {
      const email = await sendQuoteEmail({
        to: next.customer.email,
        subject: `M-Machine invoice ${next.id}`,
        html: buildCustomerInvoiceEmail(next),
        replyTo: process.env.QUOTE_OWNER_EMAIL || "sales@m-machine.co.uk",
      });
      if (!email.ok) {
        return NextResponse.json(
          { error: "Email could not be sent. Please send manually and try again later." },
          { status: 500 }
        );
      }
      const sentAt = new Date().toISOString();
      next.status = "invoice_sent";
      next.quotedAt = next.quotedAt || sentAt;
      next.invoiceSentAt = sentAt;
      next.customerEmailSentAt = sentAt;
      customerEmailSent = true;
    }

    if (body.markPaid) {
      const paidAt = new Date().toISOString();
      next.status = "paid";
      next.paidAt = paidAt;
    }

    const saved = await saveQuoteRequest(next);
    return NextResponse.json({ ok: true, quote: saved, customerEmailSent });
  } catch (err) {
    return NextResponse.json({ error: "Order could not be saved. Please try again." }, { status: 500 });
  }
}
