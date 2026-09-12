import logoBase64 from "./mini-pdf-logo.json";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { sections, type Product } from "@/lib/mini-data";
import { miniSectionPdfPageIndexes } from "@/lib/mini-section-pdfs";
import { catalogueMoney } from "@/lib/catalogue-pricing";

type PrintProduct = Product & { drawingRef?: string; pdfColumn?: number; pdfExVat?: string; pdfIncVat?: string };
export const MINI_PAGE_MAP_PREFIX = "M-Machine sections: ";

function printable(value: string) {
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/×/g, "x").replace(/[^\x20-\x7e£]/g, " ");
}

function wrap(value: string, font: PDFFont, width: number, size: number) {
  const lines: string[] = [];
  let line = "";
  for (const char of printable(value)) {
    if (font.widthOfTextAtSize(line + char, size) > width && line) {
      const space = line.lastIndexOf(" ");
      if (space > 0) { lines.push(line.slice(0, space)); line = line.slice(space + 1); }
      else { lines.push(line); line = ""; }
    }
    line += char;
  }
  lines.push(line);
  return lines;
}

/** Keep the original drawing/cover pages; typeset every uploaded parts row without truncation. */
export async function buildMiniWorkbookPdf(products: PrintProduct[], templateBytes: Uint8Array) {
  const known = new Set(sections.map(section => section.code.toLowerCase()));
  if (products.some(product => !known.has(product.section.toLowerCase()))) throw new Error("The workbook contains an unsupported Mini section. Nothing has been updated.");
  const template = await PDFDocument.load(templateBytes, { updateMetadata: false });
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(logoBase64.base64);
  const pageMap: Record<string, number[]> = {};
  for (const page of await doc.copyPages(template, [0, 1, 2])) doc.addPage(page);
  for (const section of sections) {
    const original = miniSectionPdfPageIndexes(section.code)!;
    const indexes: number[] = [];
    if (/^\d+$/.test(section.code)) {
      indexes.push(doc.getPageCount());
      doc.addPage((await doc.copyPages(template, [original[0]]))[0]);
    }
    const rows = products.filter(p => p.section.toLowerCase() === section.code.toLowerCase());
    const columns = [rows.filter(p => (p.pdfColumn || 0) === 0), rows.filter(p => (p.pdfColumn || 0) > 0)];
    const cursors = [0, 0];
    do {
      indexes.push(doc.getPageCount());
      const page = doc.addPage([841.92, 595.32]);
      page.drawImage(logo, { x: 20, y: 10, width: 230, height: 80 });
      page.drawText(section.code, { x: 660, y: 35, size: 48, font: bold });
      for (let column = 0; column < 2; column++) {
        const x = 26 + column * 404;
        const widths = [20, 71, 225, 38, 38];
        let y = 575;
        const drawRow = (cells: string[], header = false) => {
          const size = header ? 7.5 : 7.3;
          const font = header ? bold : regular;
          const lines = cells.map((text, i) => wrap(text, font, widths[i] - 5, size));
          const height = Math.max(11, ...lines.map(l => l.length * 9 + 4));
          if (y - height < 130) return false;
          let left = x;
          lines.forEach((cell, i) => {
            page.drawRectangle({ x: left, y: y - height, width: widths[i], height, borderWidth: 0.4, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0) });
            cell.forEach((text, n) => page.drawText(text, { x: left + 2.5, y: y - 9 - n * 9, size, font }));
            left += widths[i];
          });
          y -= height;
          return true;
        };
        drawRow(["", "Code", "Description", "Price\n(ex VAT)".replace('\n', ' '), "Price inc VAT"], true);
        const start = cursors[column];
        while (cursors[column] < columns[column].length) {
          const p = columns[column][cursors[column]];
          if (!drawRow([p.drawingRef || "", p.code, p.name, catalogueMoney(p.priceExVat), catalogueMoney(p.priceIncVat)])) break;
          cursors[column]++;
        }
        if (cursors[column] === start && start < columns[column].length) throw new Error(`Section ${section.code} contains a description too long to fit. Nothing has been updated.`);
      }
    } while (cursors.some((cursor, column) => cursor < columns[column].length));
    pageMap[section.code] = indexes;
  }
  doc.addPage((await doc.copyPages(template, [41]))[0]);
  doc.setTitle("M-Machine Mini Panels Catalogue");
  doc.setAuthor("M-Machine");
  doc.setSubject(MINI_PAGE_MAP_PREFIX + JSON.stringify(pageMap));
  return doc.save();
}

