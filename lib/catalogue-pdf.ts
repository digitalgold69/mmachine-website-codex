import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import * as XLSX from "xlsx";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { sections, type Product, type Section } from "@/lib/mini-data";
import { metalCategories, type MetalProduct } from "@/lib/metals-data";
import { catalogueMoney } from "@/lib/catalogue-pricing";

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
  return catalogueMoney(value);
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
  ctx.y -= 32;
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

const METALS_FRONT_SHEETS = ["Front sheet", "Carriage Rates", "T&Cs", "Conversion table"] as const;
const METALS_CATALOGUE_TITLE = "Metals Catalogue";
const METALS_TABLE_LEFT = 70;
const METALS_TABLE_TOP = 781;
const METALS_TABLE_BOTTOM = 78;
const METALS_HEADER_HEIGHT = 14;
const METALS_ROW_FONT_SIZE = 9;
const METALS_ROW_LINE_HEIGHT = 10.2;
const METALS_MIN_ROW_HEIGHT = 12.8;
const METALS_GROUP_GAP = 8.5;
const METALS_INC_VAT_FILL = rgb(0.79, 0.95, 0.78);
const METALS_BORDER = rgb(0, 0, 0);

const METALS_COLUMNS = [
  { key: "form", label: "Shape", width: 70, align: "left" as const },
  { key: "metal", label: "Metal", width: 55, align: "left" as const },
  { key: "spec", label: "Spec.", width: 43, align: "left" as const },
  { key: "size", label: "Size", width: 115, align: "left" as const },
  { key: "priceExVat", label: "£ ex VAT", width: 53, align: "right" as const },
  { key: "unit", label: "Unit", width: 62, align: "right" as const },
  { key: "priceIncVat", label: "£ Inc VAT", width: 52, align: "right" as const, highlight: true },
] as const;

type MetalsColumn = (typeof METALS_COLUMNS)[number];

function metalsColumnX(index: number) {
  return METALS_TABLE_LEFT + METALS_COLUMNS.slice(0, index).reduce((total, column) => total + column.width, 0);
}

function drawMetalsPageTitle(ctx: PdfContext) {
  const width = ctx.regular.widthOfTextAtSize(METALS_CATALOGUE_TITLE, 9);
  ctx.page.drawText(METALS_CATALOGUE_TITLE, {
    x: (A4_WIDTH - width) / 2,
    y: A4_HEIGHT - 31,
    size: 9,
    font: ctx.regular,
    color: rgb(0, 0, 0),
  });
}

function drawMetalsPageNumber(ctx: PdfContext) {
  const label = `Page ${ctx.doc.getPageCount()}`;
  const width = ctx.regular.widthOfTextAtSize(label, 9);
  ctx.page.drawText(label, {
    x: (A4_WIDTH - width) / 2,
    y: 28,
    size: 9,
    font: ctx.regular,
    color: rgb(0, 0, 0),
  });
}

function drawTableCellText(
  ctx: PdfContext,
  text: string,
  column: MetalsColumn,
  x: number,
  y: number,
  options: { font?: PDFFont; size?: number; bold?: boolean } = {}
) {
  const size = options.size ?? METALS_ROW_FONT_SIZE;
  const font = options.font ?? (options.bold ? ctx.bold : ctx.regular);
  const cleaned = cleanPdfText(text, 260);
  const textWidth = font.widthOfTextAtSize(cleaned, size);
  const drawX = column.align === "right" ? x + column.width - 4 - textWidth : x + 3;
  ctx.page.drawText(cleaned, {
    x: drawX,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
    maxWidth: column.width - 6,
  });
}

function drawMetalsOriginalTableHeader(ctx: PdfContext) {
  const headerBottom = METALS_TABLE_TOP - METALS_HEADER_HEIGHT;

  METALS_COLUMNS.forEach((column, index) => {
    const x = metalsColumnX(index);
    ctx.page.drawRectangle({
      x,
      y: headerBottom,
      width: column.width,
      height: METALS_HEADER_HEIGHT,
      color: "highlight" in column && column.highlight ? METALS_INC_VAT_FILL : undefined,
      borderColor: METALS_BORDER,
      borderWidth: 0.75,
    });
    drawTableCellText(ctx, column.label, column, x, headerBottom + 3.2, {
      font: ctx.bold,
      size: 8.4,
      bold: true,
    });
  });

  ctx.y = headerBottom - 16;
}

function addMetalsTablePage(ctx: PdfContext) {
  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  drawMetalsPageTitle(ctx);
  drawMetalsPageNumber(ctx);
  drawMetalsOriginalTableHeader(ctx);
}

function ensureMetalsRowSpace(ctx: PdfContext, rowHeight: number) {
  if (ctx.y - rowHeight < METALS_TABLE_BOTTOM) addMetalsTablePage(ctx);
}

function metalsCellLines(value: unknown, font: PDFFont, width: number, maxLines = 3) {
  const lines = lineWrap(String(value ?? ""), font, METALS_ROW_FONT_SIZE, width - 6);
  return lines.slice(0, maxLines);
}

function drawMetalsDataCell(ctx: PdfContext, column: MetalsColumn, index: number, lines: string[], y: number, bold = false) {
  const x = metalsColumnX(index);
  const font = bold ? ctx.bold : ctx.regular;
  lines.forEach((line, lineIndex) => {
    drawTableCellText(ctx, line, column, x, y - lineIndex * METALS_ROW_LINE_HEIGHT, {
      font,
      size: METALS_ROW_FONT_SIZE,
      bold,
    });
  });
}

function metalsRowHeight(ctx: Pick<PdfContext, "regular">, product: MetalProduct) {
  const values = [
    product.form,
    product.metal,
    product.spec,
    product.size,
    money(product.priceExVat),
    product.unit,
    money(product.priceIncVat),
  ];
  const rowLines = values.map((value, index) =>
    metalsCellLines(value, ctx.regular, METALS_COLUMNS[index].width, index === 3 ? 4 : 2)
  );
  const lineCount = Math.max(1, ...rowLines.map((lines) => lines.length));
  return { rowLines, rowHeight: Math.max(METALS_MIN_ROW_HEIGHT, lineCount * METALS_ROW_LINE_HEIGHT + 2.8) };
}

function drawMetalsRow(ctx: PdfContext, product: MetalProduct) {
  const { rowLines, rowHeight } = metalsRowHeight(ctx, product);
  ensureMetalsRowSpace(ctx, rowHeight);
  const pageNumber = ctx.doc.getPageCount();

  const incIndex = METALS_COLUMNS.length - 1;
  const incX = metalsColumnX(incIndex);
  ctx.page.drawRectangle({
    x: incX,
    y: ctx.y - rowHeight + 1.5,
    width: METALS_COLUMNS[incIndex].width,
    height: rowHeight + 5.4,
    color: METALS_INC_VAT_FILL,
  });

  rowLines.forEach((lines, index) => {
    drawMetalsDataCell(ctx, METALS_COLUMNS[index], index, lines, ctx.y, index === incIndex);
  });

  ctx.y -= rowHeight;
  return pageNumber;
}

function shouldSeparateMetalsRows(previous: MetalProduct | null, current: MetalProduct) {
  if (!previous) return false;
  return previous.sourceSheet !== current.sourceSheet || previous.form !== current.form;
}

type MetalsPageRange = { start: number; end: number };
type WorkbookFrontSheet = { name: string; rows: string[][] };

function metalsTableStartY() {
  return METALS_TABLE_TOP - METALS_HEADER_HEIGHT - 16;
}

function calculateMetalsCategoryPageRanges(
  products: MetalProduct[],
  regular: PDFFont,
  frontPageCount: number
) {
  const ranges = new Map<string, MetalsPageRange>();
  let y = metalsTableStartY();
  let pageNumber = frontPageCount + 1;
  let previous: MetalProduct | null = null;

  for (const product of products) {
    if (shouldSeparateMetalsRows(previous, product)) {
      if (y - (METALS_GROUP_GAP + METALS_MIN_ROW_HEIGHT) < METALS_TABLE_BOTTOM) {
        pageNumber += 1;
        y = metalsTableStartY();
      }
      y -= METALS_GROUP_GAP;
    }

    const { rowHeight } = metalsRowHeight({ regular }, product);
    if (y - rowHeight < METALS_TABLE_BOTTOM) {
      pageNumber += 1;
      y = metalsTableStartY();
    }

    const range = ranges.get(product.category);
    if (range) {
      range.end = pageNumber;
    } else {
      ranges.set(product.category, { start: pageNumber, end: pageNumber });
    }

    y -= rowHeight;
    previous = product;
  }

  return ranges;
}

function metalsPageRangeLabel(range: MetalsPageRange) {
  return range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`;
}

function metalsPageRangePrefix(range: MetalsPageRange) {
  return range.start === range.end ? "Page" : "Pages";
}

function cellDisplayValue(cell: XLSX.CellObject | undefined) {
  return cleanPdfText(cell?.w ?? cell?.v ?? "", 500);
}

function workbookPrintRange(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  const sheetIndex = workbook.SheetNames.indexOf(sheetName);
  const printArea = (workbook.Workbook?.Names || []).find((name) => {
    if (name.Name !== "_xlnm.Print_Area") return false;
    if (typeof name.Sheet === "number" && name.Sheet === sheetIndex) return true;
    return typeof name.Ref === "string" && name.Ref.startsWith(`'${sheetName.replace(/'/g, "''")}'!`);
  });
  const ref = printArea?.Ref?.split("!").pop()?.replace(/\$/g, "") || sheet["!ref"];
  return ref ? XLSX.utils.decode_range(ref) : null;
}

function rowsFromWorkbookSheet(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  const range = workbookPrintRange(workbook, sheetName);
  if (!sheet || !range) return [];

  const rows: string[][] = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: string[] = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      row.push(cellDisplayValue(sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })]));
    }
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].every((cell) => !cell)) rows.pop();
  return rows;
}

function replaceCarriageIndexRows(rows: string[][], ranges: Map<string, MetalsPageRange>) {
  const indexRow = rows.findIndex((row) => row.some((cell) => cell.trim().toLowerCase() === "index"));
  if (indexRow < 0) return rows;

  const indexRows = metalCategories.flatMap((category) => {
    const range = ranges.get(category.key);
    if (!range) return [];
    return [["", metalsPageRangePrefix(range), metalsPageRangeLabel(range), category.label]];
  });

  return [...rows.slice(0, indexRow + 1), ...indexRows];
}

function workbookFrontSheets(workbook: XLSX.WorkBook, ranges?: Map<string, MetalsPageRange>) {
  return METALS_FRONT_SHEETS.flatMap<WorkbookFrontSheet>((name) => {
    let rows = rowsFromWorkbookSheet(workbook, name);
    if (!rows.length) return [];
    if (name === "Carriage Rates" && ranges) rows = replaceCarriageIndexRows(rows, ranges);
    return [{ name, rows }];
  });
}

function workbookSheetCellWidth(sheetName: string, row: string[], index: number, usableWidth: number) {
  const nonEmptyCount = row.filter(Boolean).length;
  if (nonEmptyCount <= 1) return usableWidth;
  if (sheetName === "Conversion table") return usableWidth / Math.max(1, Math.min(7, row.length));
  const nonEmptyIndexes = row.map((cell, cellIndex) => cell ? cellIndex : -1).filter((cellIndex) => cellIndex >= 0);
  const first = nonEmptyIndexes[0];
  const second = nonEmptyIndexes[1];
  if (index === first && row[index].length <= 4 && typeof second === "number") return 28;
  if (index === second && row[first]?.length <= 4) return usableWidth - 34;
  if (sheetName === "Carriage Rates" && index === 1) return 52;
  if (sheetName === "Carriage Rates" && index === 2) return 72;
  if (sheetName === "Carriage Rates" && index >= 3) return usableWidth - 136;
  const columns = Math.max(1, Math.min(10, row.length));
  if (index === row.length - 1) return usableWidth / columns;
  return usableWidth / columns;
}

function workbookSheetCellX(sheetName: string, row: string[], index: number, usableWidth: number) {
  const nonEmptyCount = row.filter(Boolean).length;
  if (nonEmptyCount <= 1) return MARGIN;
  if (sheetName === "Conversion table") {
    const columns = Math.max(1, Math.min(7, row.length));
    return MARGIN + (usableWidth / columns) * index;
  }
  const nonEmptyIndexes = row.map((cell, cellIndex) => cell ? cellIndex : -1).filter((cellIndex) => cellIndex >= 0);
  const first = nonEmptyIndexes[0];
  const second = nonEmptyIndexes[1];
  if (index === first && row[index].length <= 4 && typeof second === "number") return MARGIN;
  if (index === second && row[first]?.length <= 4) return MARGIN + 34;
  if (sheetName === "Carriage Rates" && index === 1) return MARGIN + 34;
  if (sheetName === "Carriage Rates" && index === 2) return MARGIN + 88;
  if (sheetName === "Carriage Rates" && index >= 3) return MARGIN + 136;
  const columns = Math.max(1, Math.min(10, row.length));
  return MARGIN + (usableWidth / columns) * index;
}

function workbookRowsPageCount(sheet: WorkbookFrontSheet, regular: PDFFont, bold: PDFFont) {
  let pages = 1;
  let y = A4_HEIGHT - MARGIN;
  const usableWidth = A4_WIDTH - MARGIN * 2;

  for (const [rowIndex, row] of sheet.rows.entries()) {
    const metrics = workbookRowMetrics(sheet.name, row, rowIndex, usableWidth, regular, bold);
    if (y - metrics.height < MARGIN) {
      pages += 1;
      y = A4_HEIGHT - MARGIN;
    }
    y -= metrics.height;
  }

  return pages;
}

function workbookRowMetrics(
  sheetName: string,
  row: string[],
  rowIndex: number,
  usableWidth: number,
  regular: PDFFont,
  bold: PDFFont
) {
  const isTitle = rowIndex === 0 && row.filter(Boolean).length <= 2;
  const isIndexHeading = row.some((cell) => cell.trim().toLowerCase() === "index");
  const isConversion = sheetName === "Conversion table";
  const size = isTitle ? 14 : isIndexHeading ? 10.5 : isConversion ? 7.4 : 8.7;
  const font = isTitle || isIndexHeading ? bold : regular;
  const lineHeight = size + (isConversion ? 1.4 : 2.2);
  const maxLines = Math.max(
    1,
    ...row.map((cell, index) =>
      cell ? lineWrap(cell, font, size, workbookSheetCellWidth(sheetName, row, index, usableWidth) - 6).length : 1
    )
  );
  return {
    font,
    size,
    lineHeight,
    height: Math.max(isTitle ? 24 : isConversion ? 10 : 13, maxLines * lineHeight + 3),
  };
}

function drawWorkbookRowsPage(ctx: PdfContext, sheet: WorkbookFrontSheet) {
  const usableWidth = A4_WIDTH - MARGIN * 2;
  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.y = A4_HEIGHT - MARGIN;

  sheet.rows.forEach((row, rowIndex) => {
    const metrics = workbookRowMetrics(sheet.name, row, rowIndex, usableWidth, ctx.regular, ctx.bold);
    if (ctx.y - metrics.height < MARGIN) {
      ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
      ctx.y = A4_HEIGHT - MARGIN;
    }

    row.forEach((cell, index) => {
      if (!cell) return;
      const x = workbookSheetCellX(sheet.name, row, index, usableWidth);
      const width = workbookSheetCellWidth(sheet.name, row, index, usableWidth);
      lineWrap(cell, metrics.font, metrics.size, width - 6).slice(0, 3).forEach((line, lineIndex) => {
        ctx.page.drawText(line, {
          x,
          y: ctx.y - metrics.size - lineIndex * metrics.lineHeight,
          size: metrics.size,
          font: metrics.font,
          color: rgb(0, 0, 0),
          maxWidth: width - 6,
        });
      });
    });

    ctx.y -= metrics.height;
  });
}

async function createMetalsCatalogueContext(workbookBytes?: Uint8Array, products: MetalProduct[] = []): Promise<PdfContext> {
  const doc = await PDFDocument.create();
  doc.setTitle("M-Machine Metals Catalogue");
  doc.setAuthor("M-Machine");
  doc.setProducer("M-Machine catalogue upload");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: PdfContext = {
    doc,
    regular,
    bold,
    page: doc.addPage([A4_WIDTH, A4_HEIGHT]),
    y: METALS_TABLE_TOP,
  };
  doc.removePage(doc.getPageCount() - 1);

  let workbook: XLSX.WorkBook | null = null;
  if (workbookBytes?.byteLength) {
    try {
      workbook = XLSX.read(workbookBytes, {
        type: "array",
        cellDates: false,
        cellNF: false,
        cellStyles: false,
        bookVBA: false,
      });
    } catch {
      workbook = null;
    }
  }

  if (workbook) {
    let frontSheets = workbookFrontSheets(workbook);
    let frontPageCount = frontSheets.reduce((sum, sheet) => sum + workbookRowsPageCount(sheet, regular, bold), 0);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ranges = calculateMetalsCategoryPageRanges(products, regular, frontPageCount);
      const nextFrontSheets = workbookFrontSheets(workbook, ranges);
      const nextFrontPageCount = nextFrontSheets.reduce(
        (sum, sheet) => sum + workbookRowsPageCount(sheet, regular, bold),
        0
      );
      frontSheets = nextFrontSheets;
      if (nextFrontPageCount === frontPageCount) break;
      frontPageCount = nextFrontPageCount;
    }

    frontSheets.forEach((sheet) => drawWorkbookRowsPage(ctx, sheet));
  }

  addMetalsTablePage(ctx);
  return ctx;
}

export async function buildMetalsCataloguePdfBytes(products: MetalProduct[], workbookBytes?: Uint8Array) {
  const ctx = await createMetalsCatalogueContext(workbookBytes, products);
  let previous: MetalProduct | null = null;

  for (const product of products) {
    if (shouldSeparateMetalsRows(previous, product)) {
      ensureMetalsRowSpace(ctx, METALS_GROUP_GAP + METALS_MIN_ROW_HEIGHT);
      ctx.y -= METALS_GROUP_GAP;
    }
    drawMetalsRow(ctx, product);
    previous = product;
  }

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
