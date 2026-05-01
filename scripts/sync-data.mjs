#!/usr/bin/env node
// sync-data.mjs  ── Regenerates lib/mini-data.ts and lib/metals-data.ts
// from the master Excel files in /data-source.
//
// Usage:  npm run sync-data
//
// Source files expected (place these in /data-source — see DATA-SOURCE-README.md):
//   data-source/PartsbookBenji2014.xlsx              (Mini parts master)
//   data-source/Metals.xlsx                          (Metals master)
//   data-source/Mini Catalogue Self Updating.xlsm   (optional — used only for Apx1/Apx2 part codes)
//
// What it overwrites:
//   lib/mini-data.ts    — DO NOT EDIT BY HAND
//   lib/metals-data.ts  — DO NOT EDIT BY HAND
//
// Anything outside lib/mini-data.ts and lib/metals-data.ts is left alone.

import * as XLSX from "xlsx";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_DIR = resolve(ROOT, "data-source");
const LIB_DIR = resolve(ROOT, "lib");

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function logStep(msg) {
  console.log("→ " + msg);
}
function logOk(msg) {
  console.log("  ✓ " + msg);
}
function logWarn(msg) {
  console.warn("  ! " + msg);
}
function fatal(msg) {
  console.error("\n✘ " + msg);
  console.error("  Stopping. Nothing was written.");
  process.exit(1);
}

function loadWorkbook(name) {
  const path = resolve(SRC_DIR, name);
  if (!existsSync(path)) {
    fatal(
      `Missing source file: data-source/${name}\n` +
        `  Drop the file into ${SRC_DIR} and run again.`
    );
  }
  logStep(`Reading ${name}`);
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: "buffer", cellDates: false });
}

function sheetToRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
}

function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function asNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────
// MINI DATA — sections list (from PDF, same as before)
// ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { code: "120", label: "REAR PANEL",         subtitle: "Rear doors, Tailgate, Cab & Bulkhead",                order: 1,  mode: "exterior" },
  { code: "130", label: "SIDE REPAIRS",       subtitle: "Apex Panels, Lamp Panels, Door Steps",                order: 2,  mode: "exterior" },
  { code: "140", label: "SIDE REPAIRS",       subtitle: "Traveller Wood Kit, Quarter Panels",                  order: 3,  mode: "exterior" },
  { code: "150", label: "DOORS",              subtitle: "Door Skins Repairs, Window Rails",                    order: 4,  mode: "exterior" },
  { code: "160", label: "FRONT & ROOF",       subtitle: "Bonnet, Outer Wings, Roof, Scuttle Panel",            order: 5,  mode: "exterior" },
  { code: "170", label: "FRONT PANEL",        subtitle: "Number Plate Hanger, Stiffener, Adaptors",            order: 6,  mode: "exterior" },
  { code: "210", label: "FRONT INNER WINGS",  subtitle: "Inner Wings, Vent Panel, Apex Panels",                order: 7,  mode: "interior" },
  { code: "220", label: "FRONT BULKHEAD",     subtitle: "Heating & Cooling, Radiator Cowls",                   order: 8,  mode: "interior" },
  { code: "230", label: "FRONT BULKHEAD",     subtitle: "Crossmember, Repair Panels, Brackets",                order: 9,  mode: "interior" },
  { code: "310", label: "FLOOR PANELS",       subtitle: "Full Floor Sections and Sills",                       order: 10, mode: "interior" },
  { code: "320", label: "FLOOR PANELS",       subtitle: "Floor Repair Panels, Half Floors, Tunnels",           order: 11, mode: "interior" },
  { code: "330", label: "FLOOR PANELS",       subtitle: "Flat Floors, Van, Traveller, Pick-ups",               order: 12, mode: "interior" },
  { code: "340", label: "FLOOR ASSEMBLY",     subtitle: "Crossmember, Companion Box, Mounts",                  order: 13, mode: "interior" },
  { code: "350", label: "INNER FLOOR",        subtitle: "Inner Sills, Heel Board, Tunnel Cover",               order: 14, mode: "interior" },
  { code: "410", label: "REAR FLOOR",         subtitle: "Boot Floor, Rear Floor, Rear Quarters",               order: 15, mode: "interior" },
  { code: "420", label: "REAR FLOOR",         subtitle: "Boot Floor Pieces, Spare Wheel Wells",                order: 16, mode: "interior" },
  { code: "430", label: "REAR FLOOR",         subtitle: "Rear Repair Panels, Estate, Pick-ups",                order: 17, mode: "interior" },
  { code: "510", label: "SUBFRAMES",          subtitle: "Front & Rear Subframes, Servo Brackets",              order: 18, mode: "interior" },
  { code: "Apx1",label: "ACCESSORIES",        subtitle: "Door Seals, Dash Vinyl, Grommets Etc",                order: 19, mode: "interior" },
  { code: "Apx2",label: "SWITCH PANELS",      subtitle: "Switch Panel Variations",                             order: 20, mode: "interior" },
];

// ─────────────────────────────────────────────────────────────────
// MINI DATA — parse PartsbookBenji
// ─────────────────────────────────────────────────────────────────

function parseDescription(desc) {
  // Returns {bodyType, mark, hand} parsed best-effort from the description string
  const d = String(desc);

  // hand
  let hand = "unhanded";
  if (/\bLH\b/.test(d) || /\bL\.H\.?\b/.test(d)) hand = "LH assembly";
  else if (/\bRH\b/.test(d) || /\bR\.H\.?\b/.test(d)) hand = "RH assembly";

  // mark — match Mk1, Mk1-2, Mk1-5, Mk3 on, Mk II, etc.
  let mark = null;
  const mkMatch = d.match(/\bMk\s*([0-9IVX]+(?:\s*[-–]\s*[0-9IVX]+)?(?:\s*on)?)/i);
  if (mkMatch) {
    const raw = mkMatch[1].replace(/\s+/g, "").replace(/–/g, "-");
    mark = "Mark " + raw.toUpperCase();
  }

  // body type — match common keywords
  let bodyType = null;
  if (/\bSaloon\b/i.test(d)) bodyType = "Saloon";
  else if (/\bTraveller\b/i.test(d) || /\bTrav\b/i.test(d)) bodyType = "Traveller";
  else if (/\bVan\b/i.test(d)) bodyType = "Van";
  else if (/\bPick[- ]?Up\b/i.test(d) || /\bPick-?up\b/i.test(d)) bodyType = "Pick-Up";
  else if (/\bEstate\b/i.test(d)) bodyType = "Estate";
  else if (/\bClubman\b/i.test(d)) bodyType = "Clubman";
  else if (/\bCooper\b/i.test(d)) bodyType = "Cooper";

  return { bodyType, mark, hand };
}

function buildFitsString({ bodyType, mark }) {
  const parts = [];
  if (bodyType) parts.push(bodyType);
  if (mark) parts.push(mark);
  return parts.join(", ") || "All";
}

function readMiniProducts(wb, apxCodes) {
  const ws = wb.Sheets["Parts Data"];
  if (!ws) fatal('Parts Data sheet not found in PartsbookBenji.');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  // Row 0 is header. Columns:
  //  0 Part No   1 Price per   2 Max   3 _   4 Description   5 Page
  const validSections = new Set(SECTIONS.filter(s => /^\d+$/.test(s.code)).map(s => s.code));

  const out = [];
  let nextId = 1;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const partNo = asString(r[0]);
    const price = asNumber(r[1]);
    const desc = asString(r[4]);
    const page = asString(r[5]);

    if (!partNo || !desc) { skipped++; continue; }

    // determine section
    let section = null;
    if (validSections.has(page)) {
      section = page;
    } else if (apxCodes.apx1.has(partNo)) {
      section = "Apx1";
    } else if (apxCodes.apx2.has(partNo)) {
      section = "Apx2";
    } else {
      skipped++;
      continue; // not part of the catalogue
    }

    const parsed = parseDescription(desc);

    out.push({
      id: "p" + String(nextId++).padStart(4, "0"),
      code: partNo,
      name: desc,
      section,
      fits: buildFitsString(parsed),
      bodyType: parsed.bodyType,
      mark: parsed.mark,
      hand: parsed.hand,
      priceExVat: price,
      priceIncVat: price !== null ? Math.round(price * 1.20 * 100) / 100 : null,
      stock: "in",
      stockQty: 0,
      category: "mini",
    });
  }
  logOk(`Mini products: ${out.length} (skipped ${skipped} non-catalogue rows)`);
  return out;
}

function readApxCodes(wb) {
  // Optional: scan APX1 / APX2 sheets in Mini Catalogue Self Updating to know which part codes belong there
  const apx1 = new Set();
  const apx2 = new Set();
  if (!wb) return { apx1, apx2 };

  for (const [sheetName, target] of [["APX1", apx1], ["APX2", apx2]]) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    for (const r of rows) {
      // The sheet has two columns of code/desc/price triples — codes appear in cols 0 and 5
      for (const col of [0, 5]) {
        const code = asString(r[col]);
        if (/^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(code) || /^[A-Z0-9]{4,}$/.test(code)) {
          target.add(code);
        }
      }
    }
  }
  logOk(`Appendix codes: Apx1=${apx1.size}, Apx2=${apx2.size}`);
  return { apx1, apx2 };
}

// ─────────────────────────────────────────────────────────────────
// METALS DATA — parse Metals.xlsx
// ─────────────────────────────────────────────────────────────────

const METALS_CATEGORIES = [
  { key: "tool_steel",  label: "Tool steels" },
  { key: "mild_steel",  label: "Mild / carbon steel" },
  { key: "stainless",   label: "Stainless steel" },
  { key: "aluminium",   label: "Aluminium" },
  { key: "brass",       label: "Brass" },
  { key: "bronze",      label: "Bronze" },
  { key: "copper",      label: "Copper" },
  { key: "cast_iron",   label: "Cast iron" },
  { key: "plastics",    label: "Plastics" },
  { key: "misc",        label: "Misc" },
];

function categoryFromSheetName(name) {
  const n = name.toLowerCase();
  if (n.startsWith("alu")) return "aluminium";
  if (n.startsWith("brass")) return "brass";
  if (n.startsWith("ph brnz")) return "bronze";
  if (n.startsWith("cu") || n.startsWith("nil ag")) return "copper";
  if (n.startsWith("st steel")) return "stainless";
  if (n.startsWith("steels")) return "mild_steel";
  if (n.startsWith("cast i")) return "cast_iron";
  if (n.startsWith("plastics")) return "plastics";
  if (n.startsWith("misc")) return "misc";
  return null;
}

function readMetals(wb) {
  const out = [];
  let nextId = 1;

  for (const sheetName of wb.SheetNames) {
    const cat = categoryFromSheetName(sheetName);
    if (!cat) continue;

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, blankrows: false });
    if (rows.length < 2) continue;

    // header row 0:  Shape | Metal | Spec. | Size | £ ex VAT | Unit | £ Inc VAT | Notes | Full £ | S- 50% | Buy Cost | Length | Supplier
    let currentShape = "";
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const shape = asString(r[0]);
      const metal = asString(r[1]);
      const spec  = asString(r[2]);
      const size  = asString(r[3]);
      const priceEx = asNumber(r[4]);
      const unit  = asString(r[5]);
      const priceInc = asNumber(r[6]);
      const notes = asString(r[7]);

      // Shape-only rows (e.g. "Rounds", "Sheet", "Eq Angle") are headings; remember shape, skip row
      if (shape && !metal && !size && priceEx === null) {
        currentShape = shape;
        continue;
      }

      const effShape = shape || currentShape;
      if (!metal && !size) continue;        // blank row
      if (priceEx === null && priceInc === null) continue;  // no price row, skip

      const pieces = [effShape, metal, spec, size].filter(Boolean);
      const name = pieces.join(" — ");
      const id = "m" + String(nextId++).padStart(4, "0");

      // Use sheet name + size as a stable code when no part number exists
      const code = (spec || metal || effShape || sheetName).replace(/\s+/g, "").substring(0, 32) +
                   (size ? "-" + size.replace(/\s+/g, "") : "");

      // If priceEx is missing, treat the row as not available (null both prices)
      const finalEx = priceEx;
      const finalInc = priceEx === null
        ? null
        : (priceInc !== null && priceInc > 0 ? priceInc : Math.round(priceEx * 1.20 * 100) / 100);

      out.push({
        id,
        code,
        name,
        category: cat,
        form: effShape,
        stock: finalEx === null ? "out" : "in",
        priceExVat: finalEx,
        priceIncVat: finalInc,
        unit,
        spec,
        size,
        notes,
        sourceSheet: sheetName,
      });
    }
  }
  logOk(`Metals products: ${out.length}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────
// File writers
// ─────────────────────────────────────────────────────────────────

function writeMiniDataFile(products) {
  const generatedAt = new Date().toISOString();
  const header = `// AUTO-GENERATED by scripts/sync-data.mjs — DO NOT EDIT BY HAND
// Source: data-source/PartsbookBenji2014.xlsx
// Generated: ${generatedAt}
// Re-run: npm run sync-data

export type StockLevel = "in" | "low" | "out";
export type SectionMode = "exterior" | "interior";

export type Product = {
  id: string;
  code: string;
  name: string;
  section: string;
  fits: string;
  bodyType: string | null;
  mark: string | null;
  hand: string | null;
  priceExVat: number | null;
  priceIncVat: number | null;
  stock: StockLevel;
  stockQty: number;
  category: "mini" | "metals";
};

export type Section = {
  code: string;
  label: string;
  subtitle: string;
  order: number;
  mode: SectionMode;
};

export const sections: Section[] = ${JSON.stringify(SECTIONS, null, 2)};

export const getSection = (code: string) => sections.find(s => s.code === code);

export const products: Product[] = ${JSON.stringify(products, null, 2)};

export const getProductsBySection = (code: string) => products.filter(p => p.section === code);
export const getProductByCode = (code: string) => products.find(p => p.code === code);
`;
  const out = resolve(LIB_DIR, "mini-data.ts");
  writeFileSync(out, header, "utf8");
  logOk(`Wrote lib/mini-data.ts (${products.length} products)`);
}

function writeMetalsDataFile(metals) {
  const generatedAt = new Date().toISOString();
  const header = `// AUTO-GENERATED by scripts/sync-data.mjs — DO NOT EDIT BY HAND
// Source: data-source/Metals.xlsx
// Generated: ${generatedAt}
// Re-run: npm run sync-data

export type MetalProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  form: string;
  stock: "in" | "low" | "out";
  priceExVat: number | null;
  priceIncVat: number | null;
  unit: string;
  spec: string;
  size: string;
  notes: string;
  sourceSheet: string;
  // legacy compat — prefer priceExVat/priceIncVat
  pricePerKg: number | null;
  description: string;
};

export const metalCategories = ${JSON.stringify(METALS_CATEGORIES, null, 2)};

export const metals: MetalProduct[] = ${JSON.stringify(
    metals.map(m => ({
      ...m,
      pricePerKg: m.priceExVat,
      description: [m.spec, m.notes].filter(Boolean).join(" — ") || m.name,
    })),
    null,
    2
  )};
`;
  const out = resolve(LIB_DIR, "metals-data.ts");
  writeFileSync(out, header, "utf8");
  logOk(`Wrote lib/metals-data.ts (${metals.length} metals)`);
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

function main() {
  console.log("\nM-Machine sync-data — regenerating website from master Excel files\n");

  const partsWb = loadWorkbook("PartsbookBenji2014.xlsx");
  const metalsWb = loadWorkbook("Metals.xlsx");

  // Optional: read appendix codes from Mini Catalogue
  let cataloguePath = "Mini Catalogue Self Updating.xlsm";
  let cat = null;
  if (existsSync(resolve(SRC_DIR, cataloguePath))) {
    cat = loadWorkbook(cataloguePath);
  } else {
    logWarn(`Optional file not found: data-source/${cataloguePath} (Apx1/Apx2 sections will be empty)`);
  }
  const apxCodes = readApxCodes(cat);

  const miniProducts = readMiniProducts(partsWb, apxCodes);
  const metalsList = readMetals(metalsWb);

  writeMiniDataFile(miniProducts);
  writeMetalsDataFile(metalsList);

  console.log("\n✓ Done. Refresh your browser to see the changes.\n");
}

main();
