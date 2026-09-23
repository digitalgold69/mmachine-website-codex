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

export const STATIC_MINI_CATALOGUE_ASSET = "/catalogue/fallback/mini-catalogue.pdf";
export const STATIC_METALS_CATALOGUE_ASSET = "/catalogue/fallback/metals-catalogue.pdf";

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
type WorkbookFrontImage = {
  relId: string;
  bytes: Uint8Array;
  extension: string;
  from: { col: number; row: number; colOff: number; rowOff: number };
  to: { col: number; row: number; colOff: number; rowOff: number };
};

type WorkbookFrontSheet = {
  name: string;
  rows: string[][];
  range: XLSX.Range;
  merges: XLSX.Range[];
  colWidths: number[];
  rowHeights: number[];
  images: WorkbookFrontImage[];
};

type WorkbookWithFiles = XLSX.WorkBook & {
  files?: Record<string, { content?: Uint8Array; data?: Uint8Array }>;
};

const EMUS_PER_POINT = 12700;
const DEFAULT_EXCEL_COL_WIDTH_POINTS = 48;
const DEFAULT_EXCEL_ROW_HEIGHT_POINTS = 12.75;
const WORKBOOK_GRID_BORDER = rgb(0.76, 0.72, 0.64);
const WORKBOOK_HEADER_FILL = rgb(0.94, 0.91, 0.82);
const WORKBOOK_PANEL_FILL = rgb(0.98, 0.96, 0.9);
const WORKBOOK_RED = rgb(0.72, 0.06, 0.04);

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

function xmlUnescape(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function xmlAttr(attrs: string, name: string) {
  const match = attrs.match(new RegExp(`(?:^|\\s)(?:[a-zA-Z0-9_]+:)?${name}="([^"]*)"`));
  return match ? xmlUnescape(match[1]) : "";
}

function workbookFileBytes(workbook: WorkbookWithFiles, path: string) {
  const file = workbook.files?.[path.replace(/^\/+/, "")];
  const content = file?.content || file?.data;
  return content ? new Uint8Array(content) : null;
}

function workbookFileText(workbook: WorkbookWithFiles, path: string) {
  const bytes = workbookFileBytes(workbook, path);
  return bytes ? new TextDecoder().decode(bytes) : "";
}

function xlsxDir(path: string) {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function normaliseXlsxPath(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveXlsxTarget(basePath: string, target: string) {
  if (target.startsWith("/")) return normaliseXlsxPath(target);
  return normaliseXlsxPath(`${xlsxDir(basePath)}/${target}`);
}

function relationshipMap(xml: string) {
  const map = new Map<string, { target: string; type: string }>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = xmlAttr(match[1], "Id");
    const target = xmlAttr(match[1], "Target");
    if (id && target) map.set(id, { target, type: xmlAttr(match[1], "Type") });
  }
  return map;
}

function workbookSheetPath(workbook: WorkbookWithFiles, sheetName: string) {
  const workbookXml = workbookFileText(workbook, "xl/workbook.xml");
  const workbookRels = relationshipMap(workbookFileText(workbook, "xl/_rels/workbook.xml.rels"));
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    if (xmlAttr(match[1], "name") !== sheetName) continue;
    const rel = workbookRels.get(xmlAttr(match[1], "id"));
    if (!rel) return null;
    return resolveXlsxTarget("xl/workbook.xml", rel.target);
  }
  return null;
}

function worksheetDrawingPath(workbook: WorkbookWithFiles, sheetPath: string) {
  const fileName = sheetPath.split("/").pop();
  if (!fileName) return null;
  const relsPath = `${xlsxDir(sheetPath)}/_rels/${fileName}.rels`;
  const rels = relationshipMap(workbookFileText(workbook, relsPath));
  for (const rel of rels.values()) {
    if (rel.type.includes("/drawing")) return resolveXlsxTarget(sheetPath, rel.target);
  }
  return null;
}

function drawingRelsPath(drawingPath: string) {
  const fileName = drawingPath.split("/").pop();
  return fileName ? `${xlsxDir(drawingPath)}/_rels/${fileName}.rels` : "";
}

function anchorMarker(anchor: string, tag: "from" | "to") {
  const marker = anchor.match(new RegExp(`<(?:xdr:)?${tag}>[\\s\\S]*?<\\/(?:xdr:)?${tag}>`))?.[0] || "";
  function number(name: string) {
    return Number(marker.match(new RegExp(`<(?:xdr:)?${name}>(-?\\d+)<\\/(?:xdr:)?${name}>`))?.[1] || 0);
  }
  return {
    col: number("col"),
    row: number("row"),
    colOff: number("colOff") / EMUS_PER_POINT,
    rowOff: number("rowOff") / EMUS_PER_POINT,
  };
}

function workbookSheetImages(workbook: WorkbookWithFiles, sheetName: string): WorkbookFrontImage[] {
  const sheetPath = workbookSheetPath(workbook, sheetName);
  const drawingPath = sheetPath ? worksheetDrawingPath(workbook, sheetPath) : null;
  if (!drawingPath) return [];

  const drawingXml = workbookFileText(workbook, drawingPath);
  const rels = relationshipMap(workbookFileText(workbook, drawingRelsPath(drawingPath)));
  const images: WorkbookFrontImage[] = [];

  for (const anchorMatch of drawingXml.matchAll(/<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g)) {
    const anchor = anchorMatch[0];
    const relId = anchor.match(/r:embed="([^"]+)"/)?.[1] || "";
    const rel = rels.get(relId);
    if (!rel) continue;
    const target = resolveXlsxTarget(drawingPath, rel.target);
    const bytes = workbookFileBytes(workbook, target);
    if (!bytes) continue;
    images.push({
      relId,
      bytes,
      extension: target.split(".").pop()?.toLowerCase() || "jpg",
      from: anchorMarker(anchor, "from"),
      to: anchorMarker(anchor, "to"),
    });
  }

  return images;
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
    const sheet = workbook.Sheets[name];
    const range = workbookPrintRange(workbook, name);
    let rows = rowsFromWorkbookSheet(workbook, name);
    if (!sheet || !range || !rows.length) return [];
    if (name === "Carriage Rates" && ranges) rows = replaceCarriageIndexRows(rows, ranges);

    const rowCount = Math.max(rows.length, range.e.r - range.s.r + 1);
    const colCount = range.e.c - range.s.c + 1;
    const cols = sheet["!cols"] || [];
    const sheetRows = sheet["!rows"] || [];
    const colWidths = Array.from({ length: colCount }, (_, index) => {
      const col = cols[range.s.c + index];
      return Number(col?.wpx ? col.wpx * 0.75 : col?.width ? col.width * 5.25 : DEFAULT_EXCEL_COL_WIDTH_POINTS);
    });
    const rowHeights = Array.from({ length: rowCount }, (_, index) => {
      const row = sheetRows[range.s.r + index];
      return Number(row?.hpt || row?.hpx || DEFAULT_EXCEL_ROW_HEIGHT_POINTS);
    });

    return [{
      name,
      rows,
      range,
      merges: sheet["!merges"] || [],
      colWidths,
      rowHeights,
      images: workbookSheetImages(workbook as WorkbookWithFiles, name),
    }];
  });
}

function workbookRowsPageCount() {
  return 1;
}

function sum(values: number[], end = values.length) {
  return values.slice(0, end).reduce((total, value) => total + value, 0);
}

function workbookMergeForCell(sheet: WorkbookFrontSheet, row: number, col: number) {
  return sheet.merges.find((merge) => (
    row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c
  ));
}

function workbookCellRect(sheet: WorkbookFrontSheet, rowIndex: number, colIndex: number) {
  const merge = workbookMergeForCell(sheet, sheet.range.s.r + rowIndex, sheet.range.s.c + colIndex);
  if (merge && (merge.s.r !== sheet.range.s.r + rowIndex || merge.s.c !== sheet.range.s.c + colIndex)) return null;

  const startCol = Math.max(sheet.range.s.c, merge?.s.c ?? sheet.range.s.c + colIndex) - sheet.range.s.c;
  const endCol = Math.min(sheet.range.e.c, merge?.e.c ?? sheet.range.s.c + colIndex) - sheet.range.s.c;
  const startRow = Math.max(sheet.range.s.r, merge?.s.r ?? sheet.range.s.r + rowIndex) - sheet.range.s.r;
  const endRow = Math.min(sheet.range.e.r, merge?.e.r ?? sheet.range.s.r + rowIndex) - sheet.range.s.r;

  return {
    col: startCol,
    row: startRow,
    x: sum(sheet.colWidths, startCol),
    y: sum(sheet.rowHeights, startRow),
    width: sum(sheet.colWidths.slice(startCol, endCol + 1)),
    height: sum(sheet.rowHeights.slice(startRow, endRow + 1)),
  };
}

function workbookCellStyle(
  sheetName: string,
  rowIndex: number,
  colIndex: number,
  text: string,
  row: string[],
  regular: PDFFont,
  bold: PDFFont
) {
  const lower = text.trim().toLowerCase();
  const nonEmpty = row.filter(Boolean).length;
  const isTitle = rowIndex === 0 || lower.includes("terms of business") || lower.includes("conversion table");
  const isIndex = lower === "index";
  const isSectionHeading = ["payment", "goods", "prices", "claims", "carriage"].includes(lower);
  const isFrontDate = sheetName === "Front sheet" && /^[a-z]+ \d{4}$/i.test(text.trim());

  let size = sheetName === "Conversion table" ? 7.2 : sheetName === "T&Cs" ? 8.1 : 8.8;
  let font = regular;
  let align: "left" | "center" | "right" = sheetName === "T&Cs" ? "left" : "center";
  let color = rgb(0, 0, 0);
  let fill: ReturnType<typeof rgb> | null = null;
  let border = false;

  if (isTitle) {
    size = sheetName === "Front sheet" ? 11 : 15;
    font = bold;
    align = "center";
    fill = WORKBOOK_HEADER_FILL;
    border = true;
  } else if (isIndex || isSectionHeading) {
    size = isIndex ? 12 : 9;
    font = bold;
    align = isIndex ? "center" : "left";
    fill = isIndex ? WORKBOOK_HEADER_FILL : null;
  } else if (isFrontDate) {
    size = 13;
    font = bold;
    align = "center";
    color = WORKBOOK_RED;
  } else if (/^\d+$/.test(text.trim()) && sheetName === "T&Cs") {
    font = bold;
    align = "right";
  } else if (sheetName === "Conversion table" && rowIndex >= 2 && rowIndex <= 3) {
    font = bold;
    align = "center";
    fill = WORKBOOK_PANEL_FILL;
    border = true;
  } else if (sheetName === "Carriage Rates" && rowIndex > 15 && nonEmpty >= 3) {
    border = true;
    if (colIndex === 1 || colIndex === 2) align = "center";
    if (colIndex >= 3) align = "left";
  }

  if (sheetName === "Conversion table" && rowIndex >= 5) {
    border = true;
    align = "center";
  }

  return { size, font, align, color, fill, border };
}

function drawWorkbookCellText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ReturnType<typeof workbookCellStyle>
) {
  const padding = 3.5;
  const lineHeight = style.size + 1.8;
  const lines = lineWrap(text, style.font, style.size, width - padding * 2);
  const maxLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight) + 1);
  const visibleLines = lines.slice(0, maxLines);
  const blockHeight = visibleLines.length * lineHeight;
  const startY = y + Math.max(padding, (height - blockHeight) / 2) + blockHeight - style.size;

  visibleLines.forEach((line, index) => {
    const textWidth = style.font.widthOfTextAtSize(line, style.size);
    let drawX = x + padding;
    if (style.align === "center") drawX = x + Math.max(padding, (width - textWidth) / 2);
    if (style.align === "right") drawX = x + width - padding - textWidth;
    ctx.page.drawText(line, {
      x: drawX,
      y: startY - index * lineHeight,
      size: style.size,
      font: style.font,
      color: style.color,
      maxWidth: width - padding * 2,
    });
  });
}

async function drawWorkbookImages(ctx: PdfContext, sheet: WorkbookFrontSheet, scale: number, xOrigin: number, yTop: number) {
  for (const image of sheet.images) {
    const fromCol = image.from.col - sheet.range.s.c;
    const toCol = image.to.col - sheet.range.s.c;
    const fromRow = image.from.row - sheet.range.s.r;
    const toRow = image.to.row - sheet.range.s.r;
    if (toCol < 0 || toRow < 0 || fromCol >= sheet.colWidths.length || fromRow >= sheet.rowHeights.length) continue;

    const rawX = sum(sheet.colWidths, Math.max(0, fromCol)) + image.from.colOff;
    const rawY = sum(sheet.rowHeights, Math.max(0, fromRow)) + image.from.rowOff;
    const rawRight = sum(sheet.colWidths, Math.max(0, toCol)) + image.to.colOff;
    const rawBottom = sum(sheet.rowHeights, Math.max(0, toRow)) + image.to.rowOff;
    const width = Math.max(1, (rawRight - rawX) * scale);
    const height = Math.max(1, (rawBottom - rawY) * scale);
    const x = xOrigin + rawX * scale;
    const y = yTop - (rawY + (rawBottom - rawY)) * scale;

    const embedded = image.extension === "png"
      ? await ctx.doc.embedPng(image.bytes)
      : await ctx.doc.embedJpg(image.bytes);
    ctx.page.drawImage(embedded, { x, y, width, height });
  }
}

function drawWorkbookWrappedText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    size: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    align?: "left" | "center" | "right";
  }
) {
  const font = options.font || ctx.regular;
  const size = options.size;
  const lineHeight = options.lineHeight || size + 3.5;
  const lines = lineWrap(text, font, size, width);
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    let drawX = x;
    if (options.align === "center") drawX = x + Math.max(0, (width - lineWidth) / 2);
    if (options.align === "right") drawX = x + Math.max(0, width - lineWidth);
    ctx.page.drawText(line, {
      x: drawX,
      y: y - index * lineHeight,
      size,
      font,
      color: options.color || rgb(0, 0, 0),
      maxWidth: width,
    });
  });
  return lines.length * lineHeight;
}

function firstRowText(row: string[] | undefined) {
  return row?.map((cell) => cell.trim()).find(Boolean) || "";
}

function drawCarriageRatesPage(ctx: PdfContext, sheet: WorkbookFrontSheet) {
  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.y = A4_HEIGHT - MARGIN;

  const title = firstRowText(sheet.rows[0]) || "Carriage Rates (incl VAT)";
  drawWorkbookWrappedText(ctx, title, MARGIN, A4_HEIGHT - 78, A4_WIDTH - MARGIN * 2, {
    size: 20,
    font: ctx.bold,
    align: "center",
  });
  ctx.page.drawLine({
    start: { x: 178, y: A4_HEIGHT - 84 },
    end: { x: 417, y: A4_HEIGHT - 84 },
    color: rgb(0, 0, 0),
    thickness: 1.1,
  });

  const boxedRows = [2, 4, 6]
    .map((rowIndex) => firstRowText(sheet.rows[rowIndex]))
    .filter(Boolean);
  let y = A4_HEIGHT - 122;
  boxedRows.forEach((line) => {
    ctx.page.drawRectangle({
      x: 58,
      y: y - 14,
      width: 478,
      height: 23,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
    });
    drawWorkbookWrappedText(ctx, line, 64, y - 8, 466, {
      size: 16,
      font: ctx.regular,
      align: "center",
      lineHeight: 18,
    });
    y -= 34;
  });

  y -= 7;
  [8, 9].forEach((rowIndex) => {
    const line = firstRowText(sheet.rows[rowIndex]);
    if (!line) return;
    drawWorkbookWrappedText(ctx, line, MARGIN, y, A4_WIDTH - MARGIN * 2, {
      size: 10.5,
      align: "center",
      lineHeight: 13,
    });
    y -= 15;
  });

  y -= 8;
  [11, 12].forEach((rowIndex) => {
    const line = firstRowText(sheet.rows[rowIndex]);
    if (!line) return;
    drawWorkbookWrappedText(ctx, line, 74, y, A4_WIDTH - 148, {
      size: 10.5,
      font: ctx.bold,
      align: "center",
      lineHeight: 13,
    });
    y -= 15;
  });

  y = A4_HEIGHT - 358;
  drawWorkbookWrappedText(ctx, "INDEX", MARGIN, y, A4_WIDTH - MARGIN * 2, {
    size: 20,
    font: ctx.bold,
    align: "center",
  });
  y -= 38;

  const indexRow = sheet.rows.findIndex((row) => row.some((cell) => cell.trim().toLowerCase() === "index"));
  const indexRows = indexRow >= 0 ? sheet.rows.slice(indexRow + 1) : [];
  for (const row of indexRows) {
    const cells = row.map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    const [prefix, pages, ...labelParts] = cells;
    const label = labelParts.join(" ");
    ctx.page.drawText(prefix, { x: 108, y, size: 10, font: ctx.regular, color: rgb(0, 0, 0) });
    ctx.page.drawText(pages, { x: 164, y, size: 10, font: ctx.regular, color: rgb(0, 0, 0) });
    const used = drawWorkbookWrappedText(ctx, label, 218, y, 295, {
      size: 10,
      font: ctx.regular,
      lineHeight: 13,
    });
    y -= Math.max(18, used + 3);
  }
}

function drawTermsWorkbookPage(ctx: PdfContext, sheet: WorkbookFrontSheet) {
  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.y = A4_HEIGHT - MARGIN;

  const title = sheet.rows.flatMap((row) => row).find((cell) => /terms of business/i.test(cell)) || "Terms of Business, Pricing and Delivery";

  drawWorkbookWrappedText(ctx, title, 88, A4_HEIGHT - 92, A4_WIDTH - 176, {
    size: 16,
    font: ctx.bold,
    align: "center",
  });

  type TermsItem = { number: string; text: string };
  type TermsSection = { heading: string; items: TermsItem[] };
  const sections: TermsSection[] = [];
  let currentSection: TermsSection | null = null;
  let currentItem: TermsItem | null = null;

  function cleanTermsText(texts: string[]) {
    if (!texts.length) return "";
    const main = texts[0];
    const combined = texts.join(" ");
    if (/maximum/i.test(main) && /2\s*meters/i.test(combined)) {
      return "We can supply lengths up to a maximum of 2 meters";
    }
    if (/minimum/i.test(main) && /\b12\b/.test(combined) && /small orders/i.test(combined)) {
      return "We reserve the right to charge a minimum of £12 for goods on small orders.";
    }
    return main;
  }

  for (const row of sheet.rows) {
    const first = row[0]?.trim() || "";
    const texts = row.slice(1).map((cell) => cell.trim()).filter(Boolean);
    if (/terms of business/i.test(texts.join(" "))) continue;
    if (first && !/^\d+$/.test(first)) {
      currentSection = { heading: first, items: [] };
      sections.push(currentSection);
      currentItem = null;
      continue;
    }
    if (/^\d+$/.test(first)) {
      if (!currentSection) {
        currentSection = { heading: "", items: [] };
        sections.push(currentSection);
      }
      currentItem = { number: first, text: cleanTermsText(texts) };
      currentSection.items.push(currentItem);
      continue;
    }
    if (currentItem && texts.length) {
      const continuation = cleanTermsText(texts);
      if (continuation) currentItem.text = `${currentItem.text} ${continuation}`.trim();
    }
  }

  let y = A4_HEIGHT - 156;
  const left = 86;
  const numberX = 112;
  const textX = 142;
  const textWidth = A4_WIDTH - textX - 84;
  for (const section of sections) {
    if (!section.heading && !section.items.length) continue;
    if (section.heading) {
      ctx.page.drawText(section.heading, {
        x: left,
        y,
        size: 11,
        font: ctx.bold,
        color: rgb(0, 0, 0),
      });
      y -= 34;
    }
    for (const item of section.items) {
      ctx.page.drawText(item.number, {
        x: numberX,
        y,
        size: 9.6,
        font: ctx.bold,
        color: rgb(0, 0, 0),
      });
      const used = drawWorkbookWrappedText(ctx, item.text, textX, y, textWidth, {
        size: 9.6,
        font: ctx.regular,
        lineHeight: 14,
      });
      y -= Math.max(32, used + 16);
    }
    y -= 6;
  }
}

async function drawWorkbookRowsPage(ctx: PdfContext, sheet: WorkbookFrontSheet) {
  if (sheet.name === "Carriage Rates") {
    drawCarriageRatesPage(ctx, sheet);
    return;
  }
  if (sheet.name === "T&Cs") {
    drawTermsWorkbookPage(ctx, sheet);
    return;
  }

  ctx.page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.y = A4_HEIGHT - MARGIN;
  const totalWidth = sum(sheet.colWidths);
  const totalHeight = sum(sheet.rowHeights);
  const scale = Math.min((A4_WIDTH - MARGIN * 2) / totalWidth, (A4_HEIGHT - MARGIN * 2) / totalHeight, 1.25);
  const pageWidth = totalWidth * scale;
  const pageHeight = totalHeight * scale;
  const xOrigin = (A4_WIDTH - pageWidth) / 2;
  const yTop = (A4_HEIGHT + pageHeight) / 2;

  await drawWorkbookImages(ctx, sheet, scale, xOrigin, yTop);

  sheet.rows.forEach((row, rowIndex) => {
    row.forEach((cell, index) => {
      if (!cell) return;
      const rect = workbookCellRect(sheet, rowIndex, index);
      if (!rect) return;
      const x = xOrigin + rect.x * scale;
      const y = yTop - (rect.y + rect.height) * scale;
      const width = rect.width * scale;
      const height = rect.height * scale;
      const style = workbookCellStyle(sheet.name, rowIndex, index, cell, row, ctx.regular, ctx.bold);

      if (style.fill) {
        ctx.page.drawRectangle({ x, y, width, height, color: style.fill });
      }

      if (style.border) {
        ctx.page.drawRectangle({
          x,
          y,
          width,
          height,
          borderColor: WORKBOOK_GRID_BORDER,
          borderWidth: 0.5,
        });
      }

      drawWorkbookCellText(ctx, cell, x, y, width, height, style);
    });
  });

  if (sheet.name === "Front sheet") {
    ctx.page.drawRectangle({
      x: xOrigin,
      y: yTop - pageHeight,
      width: pageWidth,
      height: pageHeight,
      borderColor: rgb(0.86, 0.82, 0.72),
      borderWidth: 0.65,
    });
  }
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

  let workbook: WorkbookWithFiles | null = null;
  if (workbookBytes?.byteLength) {
    try {
      workbook = XLSX.read(workbookBytes, {
        type: "array",
        cellDates: false,
        cellNF: false,
        cellStyles: true,
        bookFiles: true,
        bookVBA: false,
      } as XLSX.ParsingOptions & { bookFiles: true }) as WorkbookWithFiles;
    } catch {
      workbook = null;
    }
  }

  if (workbook) {
    let frontSheets = workbookFrontSheets(workbook);
    let frontPageCount = frontSheets.reduce((total) => total + workbookRowsPageCount(), 0);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ranges = calculateMetalsCategoryPageRanges(products, regular, frontPageCount);
      const nextFrontSheets = workbookFrontSheets(workbook, ranges);
      const nextFrontPageCount = nextFrontSheets.reduce(
        (total) => total + workbookRowsPageCount(),
        0
      );
      frontSheets = nextFrontSheets;
      if (nextFrontPageCount === frontPageCount) break;
      frontPageCount = nextFrontPageCount;
    }

    for (const sheet of frontSheets) {
      await drawWorkbookRowsPage(ctx, sheet);
    }
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
    const assetResponse = await env.ASSETS.fetch(new Request(new URL(pathname, request.url)));
    const headers = new Headers(assetResponse.headers);
    headers.set("Cache-Control", "no-store");
    if (assetResponse.ok) {
      headers.set("Content-Type", headers.get("Content-Type") || "application/pdf");
      headers.set("X-Content-Type-Options", "nosniff");
    }
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const body = await readFile(join(process.cwd(), "public", pathname.replace(/^\/+/, "")));
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
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
