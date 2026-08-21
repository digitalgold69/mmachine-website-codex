import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { getQuoteFilesBucket } from "@/lib/cloudflare";
import {
  buildCustomerInvoiceEmailForRuntime,
  buildOwnerQuoteEmailForRuntime,
  CUSTOMER_INVOICE_FROM_NAME,
  ownerNotificationFromName,
  ownerQuoteRecipientsForRuntime,
  sendQuoteEmail,
} from "@/lib/quote-email";
import {
  ACCOUNTING_BUCKETS,
  emptyAccountingTotals,
  quoteRefunds,
  remainingRefundByBucket,
  roundAccounting,
  websiteInvoiceDisplay,
} from "@/lib/order-accounting";
import {
  getQuoteRequest,
  ensureRefundInvoiceNumbers,
  ensureWebsiteInvoiceNumber,
  listActiveQuoteRequests,
  listPaidQuoteHistory,
  saveQuoteRequest,
} from "@/lib/quotes";
import type {
  CustomQuoteDetails,
  QuoteAccountingBucket,
  QuoteFile,
  QuoteItem,
  QuotePaymentMethod,
  QuoteRefundLine,
  QuoteRequest,
  QuoteStatus,
} from "@/lib/quote-types";
import { products } from "@/lib/mini-data";
import { metals } from "@/lib/metals-data";
import { calculateMetalOrderItem, getMetalOrderConfig } from "@/lib/metal-pricing";
import { checkRateLimit } from "@/lib/request-limits";
import { readCompletedFileToken } from "@/lib/quote-upload-token";
import { normaliseQuoteDelivery } from "@/lib/quote-delivery";
import type { QuoteCustomer } from "@/lib/quote-types";
import { ukHistoryBounds, ukMonthBounds } from "@/lib/uk-time";
import { listFeaturedWork, type FeaturedWork } from "@/lib/featured";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CUSTOM_FILES = 10;
const MAX_ORDER_LINES = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINI_VEHICLE_MODELS = ["Saloon", "Van", "Traveller", "Pickup"];

const miniById = new Map(products.map((product) => [product.id, product]));
const metalsById = new Map(metals.map((product) => [product.id, product]));

function asString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function asNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function safePaymentMethod(value: unknown, fallback: QuotePaymentMethod = "card"): QuotePaymentMethod {
  return value === "bacs" || value === "cash" || value === "card" ? value : fallback;
}

function safePaymentLink(value: unknown) {
  const raw = asString(value, 1200);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normaliseMiniVehicleModel(value: unknown) {
  const raw = asString(value, 40).replace(/^pick-up$/i, "Pickup");
  return MINI_VEHICLE_MODELS.find((model) => model.toLowerCase() === raw.toLowerCase()) || "";
}

function safeMetalDimensions(raw: unknown): QuoteItem["metalDimensions"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as NonNullable<QuoteItem["metalDimensions"]>;
  const mode = source.mode === "sheet" || source.mode === "fixed" || source.mode === "length"
    ? source.mode
    : null;
  const display = asString(source.display, 120);
  if (!mode || !display) return undefined;
  const lengthMm = asNumberOrNull(source.lengthMm);
  const widthMm = asNumberOrNull(source.widthMm);
  const inputUnit = source.inputUnit === "imperial" ? "imperial" : source.inputUnit === "metric" ? "metric" : undefined;
  const inputLength = asNumberOrNull(source.inputLength);
  const inputWidth = asNumberOrNull(source.inputWidth);
  return {
    mode,
    ...(lengthMm !== null ? { lengthMm } : {}),
    ...(widthMm !== null ? { widthMm } : {}),
    ...(inputUnit ? { inputUnit } : {}),
    ...(inputLength !== null ? { inputLength } : {}),
    ...(inputWidth !== null ? { inputWidth } : {}),
    display,
    pricedFromUnit: asString(source.pricedFromUnit, 120),
    stockSize: asString(source.stockSize, 120),
  };
}

function safeItem(raw: Partial<QuoteItem>, index: number): QuoteItem {
  const qty = Math.max(1, Math.min(999, Math.floor(Number(raw.qty) || 1)));
  const catalogue = raw.catalogue === "custom"
    ? "custom"
    : raw.catalogue === "metals"
      ? "metals"
      : raw.catalogue === "featured"
        ? "featured"
        : "mini";
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
    stockSize: asString(raw.stockSize, 120),
    unit: asString(raw.unit, 120),
    qty,
    unitPriceExVat: asNumberOrNull(raw.unitPriceExVat),
    unitPriceIncVat: asNumberOrNull(raw.unitPriceIncVat),
    metalDimensions: safeMetalDimensions(raw.metalDimensions),
    custom: raw.custom,
  };
}

function safePublicItem(
  raw: Partial<QuoteItem>,
  index: number,
  featuredById: Map<string, FeaturedWork>
): QuoteItem {
  const qty = Math.max(1, Math.min(999, Math.floor(Number(raw.qty) || 1)));
  const productId = asString(raw.productId, 120);

  if (raw.catalogue === "mini") {
    const product = miniById.get(productId);
    if (!product) throw new Error(`Item ${index + 1} is no longer available.`);
    return {
      key: `mini-${product.id}`,
      catalogue: "mini",
      productId: product.id,
      code: product.code,
      description: product.name,
      unit: "each",
      qty,
      unitPriceExVat: product.priceExVat,
      unitPriceIncVat: product.priceIncVat,
    };
  }

  if (raw.catalogue === "metals") {
    const product = metalsById.get(productId);
    if (!product) throw new Error(`Item ${index + 1} is no longer available.`);
    const baseItem: QuoteItem = {
      key: `metals-${product.id}`,
      catalogue: "metals",
      productId: product.id,
      code: product.code,
      description: [product.form, product.metal, product.spec, product.size]
        .filter(Boolean)
        .join(" - "),
      shape: product.form,
      metal: product.metal,
      spec: product.spec,
      size: product.size,
      stockSize: product.stockSize,
      unit: product.unit,
      qty,
      unitPriceExVat: product.priceExVat,
      unitPriceIncVat: product.priceIncVat,
    };
    const config = getMetalOrderConfig(product);
    if (config.mode === "length" || config.mode === "sheet" || config.mode === "fixed") {
      const calculated = calculateMetalOrderItem(product, raw.metalDimensions || {}, qty);
      if (!calculated.ok) throw new Error(calculated.error);
      return {
        ...baseItem,
        key: `${baseItem.key}-${calculated.keySuffix}`,
        unit: calculated.unit,
        unitPriceExVat: calculated.unitPriceExVat,
        unitPriceIncVat: calculated.unitPriceIncVat,
        metalDimensions: calculated.metalDimensions,
      };
    }
    return baseItem;
  }

  if (raw.catalogue === "featured") {
    const featured = featuredById.get(productId);
    if (!featured) throw new Error(`Item ${index + 1} is no longer available.`);
    const priceExVat = featured.priceExVat;
    return {
      key: `featured-${featured.id}`,
      catalogue: "featured",
      productId: featured.id,
      code: `FW-${featured.id.toUpperCase()}`,
      description: featured.title,
      unit: "each",
      qty,
      unitPriceExVat: priceExVat,
      unitPriceIncVat: typeof priceExVat === "number" ? Number((priceExVat * 1.2).toFixed(2)) : null,
    };
  }

  throw new Error(`Item ${index + 1} is invalid.`);
}

function safeStatus(value: unknown): QuoteStatus {
  if (value === "quoted" || value === "invoice_sent") return "invoice_sent";
  if (value === "reviewing" || value === "paid" || value === "closed") return value;
  return "new";
}

function safeRefundBucket(value: unknown): QuoteAccountingBucket | null {
  return ACCOUNTING_BUCKETS.find((bucket) => bucket === value) || null;
}

function safeRefundLines(
  rawLines: unknown,
  quote: QuoteRequest
): { lines: QuoteRefundLine[]; error: string } {
  if (!Array.isArray(rawLines)) return { lines: [], error: "Add at least one refund amount." };

  const remaining = remainingRefundByBucket(quote);
  const totals = emptyAccountingTotals();

  for (const rawLine of rawLines) {
    const line = rawLine as { bucket?: unknown; amountExVat?: unknown };
    const bucket = safeRefundBucket(line.bucket);
    const amount = asNumberOrNull(line.amountExVat);
    if (!bucket || typeof amount !== "number" || amount <= 0) continue;
    totals[bucket] = roundAccounting(totals[bucket] + amount);
  }

  const lines = ACCOUNTING_BUCKETS
    .map((bucket) => ({ bucket, amountExVat: roundAccounting(totals[bucket]) }))
    .filter((line) => line.amountExVat > 0);

  if (lines.length === 0) return { lines: [], error: "Add at least one refund amount." };

  for (const line of lines) {
    if (line.amountExVat > remaining[line.bucket] + 0.005) {
      return { lines: [], error: "Refund amount is higher than the remaining paid value for that order type." };
    }
  }

  return { lines, error: "" };
}

function quoteId(kind = "") {
  const cleanKind = kind.replace(/[^a-z0-9]+/gi, "").toUpperCase();
  const prefix = cleanKind ? `Q-${cleanKind}-` : "Q-";
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}${time}-${random}`;
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
    await bucket.put(key, file.stream(), {
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

function validateCustomFiles(files: File[]) {
  if (files.length > MAX_CUSTOM_FILES) {
    throw new Error(`Upload up to ${MAX_CUSTOM_FILES} files at a time.`);
  }
}

function uploadedFilesFromForm(form: FormData) {
  return form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function persistCustomQuote(
  id: string,
  customer: QuoteCustomer,
  custom: CustomQuoteDetails,
  files: QuoteFile[]
) {
  const now = new Date().toISOString();
  custom.files = files;

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

  let saved = await ensureWebsiteInvoiceNumber(await saveQuoteRequest(quote));
  const recipients = await ownerQuoteRecipientsForRuntime(saved);
  const email = await sendQuoteEmail({
    to: recipients,
    subject: `New M-Machine custom fabrication request ${websiteInvoiceDisplay(saved)}`,
    html: await buildOwnerQuoteEmailForRuntime(saved),
    replyTo: saved.customer.email,
    fromName: ownerNotificationFromName(saved),
  });
  if (email.ok) {
    saved = await saveQuoteRequest({
      ...saved,
      ownerEmailSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    console.error("owner_quote_email_failed", {
      quoteId: saved.id,
      skipped: email.skipped,
      code: email.code,
      missing: email.missing,
      detail: email.detail
        ? { name: email.detail.name, statusCode: email.detail.statusCode, requestId: email.detail.requestId }
        : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    quoteId: websiteInvoiceDisplay(saved),
    ownerEmailSent: email.ok,
    files: files.map((file) => ({
      name: file.name,
      size: file.size,
      path: customFileDownloadPath(file.key),
    })),
  });
}

async function createCustomQuoteJson(body: {
    customer?: Partial<QuoteCustomer>;
  custom?: Partial<CustomQuoteDetails>;
  uploadedFiles?: { token?: string }[];
  website?: string;
}) {
  const customer: QuoteCustomer = {
    ...normaliseQuoteDelivery({
      address: body.customer?.address,
      arrangeOwnDelivery: body.customer?.arrangeOwnDelivery,
      deliveryMode: (body.customer as { deliveryMode?: unknown } | undefined)?.deliveryMode,
    }),
    name: asString(body.customer?.name, 160),
    email: asString(body.customer?.email, 220),
    phone: asString(body.customer?.phone, 80),
    company: asString(body.customer?.company, 180),
    message: asString(body.customer?.message, 2400),
  };

  if (asString(body.website, 200)) {
    return NextResponse.json({ ok: true, quoteId: quoteId("CF") });
  }
  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(customer.email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!customer.arrangeOwnDelivery && !customer.address) {
    return NextResponse.json(
      { error: "Delivery address is required unless you will arrange collection or delivery" },
      { status: 400 }
    );
  }

  const rawCustom = body.custom || {};
  const custom: CustomQuoteDetails = {
    projectName: asString(rawCustom.projectName, 200),
    material: asString(rawCustom.material, 160),
    thickness: asString(rawCustom.thickness, 80),
    services: [],
    finish: asString(rawCustom.finish, 160),
    quantity: asString(rawCustom.quantity, 80),
    units: asString(rawCustom.units, 80),
    tolerance: asString(rawCustom.tolerance, 160),
    deadline: asString(rawCustom.deadline, 160),
    budget: asString(rawCustom.budget, 100),
    drawingStatus: rawCustom.drawingStatus === "help" ? "help" : "cad",
  };
  if (!custom.projectName && !customer.message) {
    return NextResponse.json(
      { error: "Tell us what you need made before submitting the request." },
      { status: 400 }
    );
  }

  const uploadedFiles = Array.isArray(body.uploadedFiles) ? body.uploadedFiles : [];
  if (uploadedFiles.length > MAX_CUSTOM_FILES) {
    return NextResponse.json({ error: `Upload up to ${MAX_CUSTOM_FILES} files at a time.` }, { status: 400 });
  }

  let files: QuoteFile[];
  try {
    files = uploadedFiles.map((file) => readCompletedFileToken(String(file.token || "")));
  } catch {
    return NextResponse.json(
      {
        error: "One or more file uploads expired. Please submit again to re-upload them.",
        code: "UPLOAD_TOKEN_INVALID",
      },
      { status: 400 }
    );
  }

  try {
    return await persistCustomQuote(quoteId("CF"), customer, custom, files);
  } catch (error) {
    console.error("custom_quote_json_submission_failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: "Custom request could not be submitted. Please try again or call M-Machine." },
      { status: 500 }
    );
  }
}

async function createCustomQuote(req: Request) {
  const form = await req.formData();
  const drawingStatus = asString(form.get("drawingStatus"), 20) === "help" ? "help" : "cad";
  const files = uploadedFilesFromForm(form);
  validateCustomFiles(files);

  const customer = {
    ...normaliseQuoteDelivery({
      address: form.get("address"),
      arrangeOwnDelivery: form.get("arrangeOwnDelivery"),
      deliveryMode: form.get("deliveryMode"),
    }),
    name: asString(form.get("name"), 160),
    email: asString(form.get("email"), 220),
    phone: asString(form.get("phone"), 80),
    company: asString(form.get("company"), 180),
    message: asString(form.get("message"), 2400),
  };

  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(customer.email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  if (asString(form.get("website"), 200)) {
    return NextResponse.json({ ok: true, quoteId: quoteId("CF-") });
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
    services: [],
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
    const id = quoteId("CF");
    const storedFiles = await storeCustomFiles(id, files);
    return await persistCustomQuote(id, customer, custom, storedFiles);
  } catch (err) {
    console.error("custom_quote_submission_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { error: "Custom request could not be submitted. Please try again or call M-Machine." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const url = new URL(request.url);
    const quoteIdParam = asString(url.searchParams.get("quote"), 160);
    if (quoteIdParam) {
      const quote = await getQuoteRequest(quoteIdParam);
      if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      return NextResponse.json({ quote: await ensureWebsiteInvoiceNumber(quote) });
    }

    if (url.searchParams.get("history") === "paid") {
      const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
      const pageSize = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get("pageSize")) || 8)));
      const month = url.searchParams.get("month") || "";
      const time = url.searchParams.get("time") || "all";
      const orderTypeParam = url.searchParams.get("orderType") || "all";
      const orderType =
        orderTypeParam === "mini" ||
        orderTypeParam === "metals" ||
        orderTypeParam === "custom" ||
        orderTypeParam === "featured"
          ? orderTypeParam
          : "all";
      const bounds = /^\d{4}-\d{2}$/.test(month)
        ? ukMonthBounds(month)
        : ukHistoryBounds(
            time === "today" || time === "7d" || time === "month" || time === "year"
              ? time
              : "all"
          );
      const history = await listPaidQuoteHistory({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        query: asString(url.searchParams.get("q"), 200),
        start: bounds?.start.toISOString(),
        end: bounds?.end.toISOString(),
        orderType,
      });
      return NextResponse.json(history);
    }

    const quotes = await listActiveQuoteRequests();
    return NextResponse.json({ quotes });
  } catch (err) {
    return NextResponse.json(
      { error: "Orders could not be loaded. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const rateLimit = await checkRateLimit(req, "quote-request", 20, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests have been submitted. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return createCustomQuote(req);
  }

  let body: {
    kind?: "custom";
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      vehicleYear?: string;
      vehicleModel?: string;
      address?: string;
      arrangeOwnDelivery?: boolean;
      deliveryMode?: string;
      message?: string;
    };
    items?: Partial<QuoteItem>[];
    website?: string;
    custom?: Partial<CustomQuoteDetails>;
    uploadedFiles?: { token?: string }[];
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const customer = {
    ...normaliseQuoteDelivery({
      address: body.customer?.address,
      arrangeOwnDelivery: body.customer?.arrangeOwnDelivery,
      deliveryMode: body.customer?.deliveryMode,
    }),
    name: asString(body.customer?.name, 160),
    email: asString(body.customer?.email, 220),
    phone: asString(body.customer?.phone, 80),
    company: asString(body.customer?.company, 180),
    vehicleYear: asString(body.customer?.vehicleYear, 40),
    vehicleModel: normaliseMiniVehicleModel(body.customer?.vehicleModel),
    message: asString(body.customer?.message, 2000),
  };

  if (!customer.name || !customer.email || !customer.phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }

  if (body.kind === "custom") {
    return createCustomQuoteJson(body);
  }


  if (!EMAIL_PATTERN.test(customer.email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  if (asString(body.website, 200)) {
    return NextResponse.json({ ok: true, quoteId: quoteId() });
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


  if (rawItems.length > MAX_ORDER_LINES) {
    return NextResponse.json(
      { error: `Please submit no more than ${MAX_ORDER_LINES} different lines at once.` },
      { status: 400 }
    );
  }

  try {
    const needsFeatured = rawItems.some((item) => item.catalogue === "featured");
    const featuredById = needsFeatured
      ? new Map((await listFeaturedWork()).map((item) => [item.id, item]))
      : new Map<string, FeaturedWork>();
    const items = rawItems.map((item, index) => safePublicItem(item, index, featuredById));
    if (items.some((item) => item.catalogue === "mini") && (!customer.vehicleYear || !customer.vehicleModel)) {
      return NextResponse.json(
        { error: "Vehicle year and model are required for Mini panel orders." },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const featuredOnly = items.every((item) => item.catalogue === "featured");
    const quote: QuoteRequest = {
      id: quoteId(featuredOnly ? "FW" : ""),
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

    let saved = await ensureWebsiteInvoiceNumber(await saveQuoteRequest(quote));
    const recipients = await ownerQuoteRecipientsForRuntime(saved);
    const email = await sendQuoteEmail({
      to: recipients,
      subject: featuredOnly
        ? `New M-Machine Featured Work order ${websiteInvoiceDisplay(saved)}`
        : `New M-Machine quote request ${websiteInvoiceDisplay(saved)}`,
      html: await buildOwnerQuoteEmailForRuntime(saved),
      replyTo: saved.customer.email,
      fromName: ownerNotificationFromName(saved),
    });
    if (email.ok) {
      saved = await saveQuoteRequest({
        ...saved,
        ownerEmailSentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      console.error("owner_quote_email_failed", {
        quoteId: saved.id,
        skipped: email.skipped,
        code: email.code,
        missing: email.missing,
        detail: email.detail
          ? { name: email.detail.name, statusCode: email.detail.statusCode, requestId: email.detail.requestId }
          : undefined,
      });
    }
    return NextResponse.json({ ok: true, quoteId: websiteInvoiceDisplay(saved), ownerEmailSent: email.ok });
  } catch (err) {
    console.error("catalogue_quote_submission_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    const customerError = err instanceof Error && /Item \d+/.test(err.message)
      ? err.message
      : "Order request could not be submitted. Please try again or contact M-Machine.";
    return NextResponse.json(
      { error: customerError },
      { status: customerError !== "Order request could not be submitted. Please try again or contact M-Machine." ? 400 : 500 }
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
    paymentLink?: string | null;
    paymentMethod?: QuotePaymentMethod;
    emailCustomer?: boolean;
    markPaid?: boolean;
    saveNoEmail?: boolean;
    includeVat?: boolean | string | number;
    refund?: {
      reason?: string;
      lines?: unknown;
    };
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

    let next: QuoteRequest = {
      ...current,
      status: body.status ? safeStatus(body.status) : current.status,
      ownerNotes: asString(body.ownerNotes ?? current.ownerNotes, 3000),
      customerMessage: asString(body.customerMessage ?? current.customerMessage, 3000),
      carriageExVat: body.carriageExVat === undefined ? current.carriageExVat : asNumberOrNull(body.carriageExVat),
      extraChargesExVat: body.extraChargesExVat === undefined ? current.extraChargesExVat : asNumberOrNull(body.extraChargesExVat),
      paymentLink: body.paymentLink === undefined ? current.paymentLink || "" : safePaymentLink(body.paymentLink),
      paymentMethod: body.paymentMethod === undefined
        ? current.paymentMethod ?? null
        : safePaymentMethod(body.paymentMethod, current.paymentMethod || "card"),
      includeVat: asBoolean(body.includeVat, current.includeVat !== false),
      updatedAt: new Date().toISOString(),
    };

    if (Array.isArray(body.items) && body.items.length > 0) {
      if (body.items.length > MAX_ORDER_LINES) {
        return NextResponse.json({ error: "Too many invoice lines" }, { status: 400 });
      }
      next.items = body.items.map(safeItem);
    }

    if (next.status === "invoice_sent" && !next.invoiceSentAt) {
      next.invoiceSentAt = next.customerEmailSentAt || next.quotedAt || new Date().toISOString();
    }

    if (next.status === "paid" && !next.paidAt) {
      next.paidAt = new Date().toISOString();
    }

    if (body.refund) {
      if (current.status !== "paid" && !current.paidAt) {
        return NextResponse.json({ error: "Only paid orders can be refunded." }, { status: 400 });
      }

      const refundLines = safeRefundLines(body.refund.lines, next);
      if (refundLines.error) {
        return NextResponse.json({ error: refundLines.error }, { status: 400 });
      }

      const createdAt = new Date().toISOString();
      next.status = "paid";
      next.paidAt = next.paidAt || current.paidAt || createdAt;
      next.refunds = [
        ...quoteRefunds(next),
        {
          id: `refund-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
          createdAt,
          reason: asString(body.refund.reason, 500),
          lines: refundLines.lines,
        },
      ];
      next = await ensureRefundInvoiceNumbers(next);
    }

    if (body.saveNoEmail && !body.emailCustomer) {
      const incompleteLine = next.items.find(
        (item) => typeof item.unitPriceExVat !== "number" || item.unitPriceExVat < 0
      );
      if (incompleteLine) {
        return NextResponse.json(
          { error: "Add a price to every invoice line before saving it for payment." },
          { status: 400 }
        );
      }

      next = await ensureWebsiteInvoiceNumber(next);
      const savedAt = new Date().toISOString();
      next.status = "invoice_sent";
      next.quotedAt = next.quotedAt || savedAt;
      next.invoiceSentAt = next.invoiceSentAt || savedAt;
    }

    let customerEmailSent = false;
    if (body.emailCustomer) {
      const incompleteLine = next.items.find(
        (item) => typeof item.unitPriceExVat !== "number" || item.unitPriceExVat < 0
      );
      if (incompleteLine) {
        return NextResponse.json(
          { error: "Add a price to every invoice line before emailing the customer." },
          { status: 400 }
        );
      }

      next = await ensureWebsiteInvoiceNumber(next);

      const savedDraft = await saveQuoteRequest(next);
      const isUpdatedInvoice = Boolean(savedDraft.customerEmailSentAt);
      const replyTo = (await ownerQuoteRecipientsForRuntime(savedDraft))[0];
      const email = await sendQuoteEmail({
        to: savedDraft.customer.email,
        subject: `${isUpdatedInvoice ? "Updated " : ""}M-Machine invoice ${websiteInvoiceDisplay(savedDraft)}`,
        html: await buildCustomerInvoiceEmailForRuntime(savedDraft),
        replyTo,
        fromName: CUSTOMER_INVOICE_FROM_NAME,
      });
      if (!email.ok) {
        console.error("customer_invoice_email_failed", {
          quoteId: savedDraft.id,
          skipped: email.skipped,
          code: email.code,
          missing: email.missing,
          detail: email.detail
            ? { name: email.detail.name, statusCode: email.detail.statusCode, requestId: email.detail.requestId }
            : undefined,
        });
        return NextResponse.json(
          {
            error: "Invoice changes were saved, but the email could not be sent. Please try again later.",
            quote: savedDraft,
          },
          { status: 502 }
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
      const incompleteLine = next.items.find(
        (item) => typeof item.unitPriceExVat !== "number" || item.unitPriceExVat < 0
      );
      if (incompleteLine) {
        return NextResponse.json(
          { error: "Add a price to every invoice line before marking the order as paid." },
          { status: 400 }
        );
      }
      const paidAt = new Date().toISOString();
      next = await ensureWebsiteInvoiceNumber(next);
      next.status = "paid";
      next.paidAt = paidAt;
      next.paymentMethod = safePaymentMethod(body.paymentMethod, next.paymentMethod || "card");
    }

    if (next.websiteInvoiceNumber) {
      next = await ensureWebsiteInvoiceNumber(next);
    }

    const saved = await saveQuoteRequest(next);
    return NextResponse.json({ ok: true, quote: saved, customerEmailSent });
  } catch (err) {
    console.error("quote_update_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "Order could not be saved. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const id = asString(body.id, 160);
  if (!id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

  try {
    const current = await getQuoteRequest(id);
    if (!current) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const closed = await saveQuoteRequest({
      ...current,
      status: "closed",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, quote: closed });
  } catch (err) {
    console.error("quote_delete_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "Order could not be deleted. Please try again." }, { status: 500 });
  }
}
