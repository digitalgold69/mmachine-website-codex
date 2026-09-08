import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { sections, type Product, type Section } from "@/lib/mini-data";
import { metalCategories, type MetalProduct } from "@/lib/metals-data";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 34;
const VAT_RATE = 1.2;

type PdfContext = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
};

function cleanPdfText(value: unknown, max = 220) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\u00d7/g, "x")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e£]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function money(value: number | null | undefined) {
  return typeof value === "number" ? `£${value.toFixed(2)}` : "POA";
}

function lineWrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanPdfText(text, 800).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function addPage(ctx: PdfContext, title: string) {
  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.y = A4_HEIGHT - MARGIN;
  ctx.page.drawText("M-Machine", {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.bold,
    color: rgb(0.06, 0.24, 0.18),
  });
  ctx.page.drawText(title, {
    x: MARGIN,
    y: ctx.y - 17,
    size: 8,
    font: ctx.regular,
    color: rgb(0.34, 0.29, 0.24),
  });
  ctx.y -= 38;
}

function ensureSpace(ctx: PdfContext, minHeight: number, title: string) {
  if (ctx.y - minHeight < MARGIN) addPage(ctx, title);
}

function drawText(ctx: PdfContext, text: string, x: number, y: number, options: {
  size?: number;
  font?: PDFFont;
  color?: ReturnType<typeof rgb>;
  maxWidth?: number;
}) {
  ctx.page.drawText(cleanPdfText(text), {
    x,
    y,
    size: options.size || 9,
    font: options.font || ctx.regular,
    color: options.color || rgb(0.05, 0.18, 0.14),
    maxWidth: options.maxWidth,
  });
}

async function createContext(title: string): Promise<PdfContext> {
  const doc = await PDFDocument.create();
  doc.setTitle(cleanPdfText(title));
  doc.setAuthor("M-Machine");
  doc.setProducer("M-Machine catalogue upload");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfContext = {
    doc,
    regular,
    bold,
    page: doc.addPage([A4_WIDTH, A4_HEIGHT]),
    y: A4_HEIGHT - MARGIN,
  };
  ctx.page.drawText(title, {
    x: MARGIN,
    y: ctx.y,
    size: 19,
    font: bold,
    color: rgb(0.06, 0.24, 0.18),
  });
  ctx.page.drawText(`Generated ${new Date().toLocaleDateString("en-GB")}`, {
    x: MARGIN,
    y: ctx.y - 20,
    size: 9,
    font: regular,
    color: rgb(0.34, 0.29, 0.24),
  });
  ctx.y -= 52;
  return ctx;
}

function drawMiniTableHeader(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 32, title);
  const y = ctx.y;
  drawText(ctx, "CODE", MARGIN, y, { size: 7, font: ctx.bold });
  drawText(ctx, "DESCRIPTION", MARGIN + 86, y, { size: 7, font: ctx.bold });
  drawText(ctx, "EX VAT", A4_WIDTH - MARGIN - 116, y, { size: 7, font: ctx.bold });
  drawText(ctx, "INC VAT", A4_WIDTH - MARGIN - 58, y, { size: 7, font: ctx.bold });
  ctx.y -= 13;
}

function drawMiniSection(ctx: PdfContext, section: Section, rows: Product[], title: string) {
  ensureSpace(ctx, 58, title);
  drawText(ctx, `${section.code} ${section.label}`, MARGIN, ctx.y, {
    size: 13,
    font: ctx.bold,
    color: rgb(0.06, 0.24, 0.18),
  });
  drawText(ctx, section.subtitle, MARGIN, ctx.y - 15, { size: 8, color: rgb(0.34, 0.29, 0.24) });
  ctx.y -= 33;
  drawMiniTableHeader(ctx, title);

  for (const product of rows) {
    const descLines = lineWrap(product.name, ctx.regular, 8.5, 326).slice(0, 2);
    const rowHeight = Math.max(17, descLines.length * 10 + 5);
    ensureSpace(ctx, rowHeight + 6, title);
    drawText(ctx, product.code, MARGIN, ctx.y, { size: 7.5, font: ctx.regular, maxWidth: 78 });
    descLines.forEach((line, index) => {
      drawText(ctx, line, MARGIN + 86, ctx.y - index * 10, { size: 8.5, maxWidth: 326 });
    });
    drawText(ctx, money(product.priceExVat), A4_WIDTH - MARGIN - 116, ctx.y, { size: 8.2, font: ctx.bold });
    drawText(ctx, money(product.priceIncVat), A4_WIDTH - MARGIN - 58, ctx.y, { size: 8.2, font: ctx.bold });
    ctx.y -= rowHeight;
  }
  ctx.y -= 10;
}

export async function buildMiniCataloguePdfBytes(products: Product[]) {
  const title = "M-Machine Mini Panels Catalogue";
  const ctx = await createContext(title);
  drawText(ctx, `${products.length.toLocaleString("en-GB")} catalogue lines`, MARGIN, ctx.y, {
    size: 10,
    color: rgb(0.34, 0.29, 0.24),
  });
  ctx.y -= 24;

  for (const section of sections) {
    const rows = products.filter((product) => product.section.toLowerCase() === section.code.toLowerCase());
    if (rows.length) drawMiniSection(ctx, section, rows, title);
  }

  return ctx.doc.save();
}

export async function buildMiniSectionPdfBytes(section: Section, products: Product[]) {
  const title = `M-Machine Mini Section ${section.code}`;
  const ctx = await createContext(title);
  drawMiniSection(ctx, section, products, title);
  return ctx.doc.save();
}

function drawMetalsTableHeader(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 28, title);
  drawText(ctx, "SHAPE", MARGIN, ctx.y, { size: 7, font: ctx.bold });
  drawText(ctx, "MATERIAL", MARGIN + 72, ctx.y, { size: 7, font: ctx.bold });
  drawText(ctx, "SIZE", MARGIN + 190, ctx.y, { size: 7, font: ctx.bold });
  drawText(ctx, "UNIT", A4_WIDTH - MARGIN - 154, ctx.y, { size: 7, font: ctx.bold });
  drawText(ctx, "EX VAT", A4_WIDTH - MARGIN - 74, ctx.y, { size: 7, font: ctx.bold });
  ctx.y -= 13;
}

function drawMetalsCategory(ctx: PdfContext, label: string, rows: MetalProduct[], title: string) {
  ensureSpace(ctx, 52, title);
  drawText(ctx, label, MARGIN, ctx.y, {
    size: 13,
    font: ctx.bold,
    color: rgb(0.06, 0.24, 0.18),
  });
  ctx.y -= 22;
  drawMetalsTableHeader(ctx, title);

  for (const product of rows) {
    const material = [product.metal, product.spec].filter(Boolean).join(" ");
    const sizeLines = lineWrap(product.size, ctx.regular, 8, 190).slice(0, 2);
    const rowHeight = Math.max(17, sizeLines.length * 10 + 5);
    ensureSpace(ctx, rowHeight + 6, title);
    drawText(ctx, product.form, MARGIN, ctx.y, { size: 8, maxWidth: 66 });
    drawText(ctx, material, MARGIN + 72, ctx.y, { size: 8, maxWidth: 112 });
    sizeLines.forEach((line, index) => {
      drawText(ctx, line, MARGIN + 190, ctx.y - index * 10, { size: 8, maxWidth: 190 });
    });
    drawText(ctx, product.unit, A4_WIDTH - MARGIN - 154, ctx.y, { size: 7.5, maxWidth: 72 });
    drawText(ctx, money(product.priceExVat), A4_WIDTH - MARGIN - 74, ctx.y, { size: 8.2, font: ctx.bold });
    ctx.y -= rowHeight;
  }
  ctx.y -= 10;
}

export async function buildMetalsCataloguePdfBytes(products: MetalProduct[]) {
  const title = "M-Machine Metals Catalogue";
  const ctx = await createContext(title);
  drawText(ctx, `${products.length.toLocaleString("en-GB")} catalogue lines`, MARGIN, ctx.y, {
    size: 10,
    color: rgb(0.34, 0.29, 0.24),
  });
  ctx.y -= 24;

  for (const category of metalCategories) {
    const rows = products.filter((product) => product.category === category.key);
    if (rows.length) drawMetalsCategory(ctx, category.label, rows, title);
  }

  const uncategorised = products.filter(
    (product) => !metalCategories.some((category) => category.key === product.category)
  );
  if (uncategorised.length) drawMetalsCategory(ctx, "Other Metals", uncategorised, title);

  return ctx.doc.save();
}

export async function staticCatalogueAssetResponse(request: Request, pathname: string) {
  const env = await getCloudflareEnv().catch(() => null);
  if (env?.ASSETS) {
    return env.ASSETS.fetch(new Request(new URL(pathname, request.url)));
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const body = await readFile(join(process.cwd(), "public", pathname.replace(/^\/+/, "")));
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("Catalogue PDF could not be loaded", { status: 502 });
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
