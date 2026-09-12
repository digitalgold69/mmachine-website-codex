import * as XLSX from "xlsx";
import { products as generatedMiniProducts, type Product } from "@/lib/mini-data";
import { metals as generatedMetals, type MetalProduct } from "@/lib/metals-data";

export type CatalogueUploadKind = "mini" | "metals";

export type ParsedCatalogueUpload =
  | {
      catalogue: "mini";
      products: Product[];
      warnings: string[];
    }
  | {
      catalogue: "metals";
      products: MetalProduct[];
      warnings: string[];
    };

const VAT_RATE = 1.2;
const PART_CODE_PATTERN = /^[\d.]+\.\d{2}\.\d{2}\.\d{2}[A-Z]?$|^[A-Z0-9-]{4,}$/i;

function cleanText(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\u00d7/g, "x")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function priceOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return round2(value);
  const text = cleanText(value, 80);
  if (!text || /^poa$/i.test(text) || /^[-–—]+$/.test(text)) return null;
  const parsed = Number(text.replace(/£|,|\s/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : null;
}

function normaliseKey(value: unknown) {
  return cleanText(value, 240)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9."]+/g, "");
}

function slug(value: unknown, fallback: string) {
  const clean = cleanText(value, 240)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 84);
  return clean || fallback;
}

function rowsFromSheet(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
}

function looksLikePartCode(value: string) {
  if (!value || value.includes(" ") || value.length < 3 || value.length > 30) return false;
  return PART_CODE_PATTERN.test(value);
}

function findCodeDescColumns(headerRow: unknown[]) {
  const pairs: Array<{ codeIndex: number; descIndex: number }> = [];
  headerRow.forEach((value, index) => {
    if (cleanText(value).toLowerCase() === "code" && index + 1 < headerRow.length) {
      pairs.push({ codeIndex: index, descIndex: index + 1 });
    }
  });
  return pairs;
}

function parseMiniDescription(description: string) {
  let hand: Product["hand"] = "unhanded";
  if (/\bLH\b|\bL\.H\.?\b/i.test(description)) hand = "LH assembly";
  else if (/\bRH\b|\bR\.H\.?\b/i.test(description)) hand = "RH assembly";

  let mark: Product["mark"] = null;
  const markMatch = description.match(/\bMk\s*([0-9IVX]+(?:\s*[-–]\s*[0-9IVX]+)?(?:\s*on)?)/i);
  if (markMatch) {
    mark = `Mark ${markMatch[1].replace(/\s+/g, "").replace(/–/g, "-").toUpperCase()}`;
  }

  let bodyType: Product["bodyType"] = null;
  if (/\bSaloon\b/i.test(description)) bodyType = "Saloon";
  else if (/\bTraveller\b|\bTrav\b/i.test(description)) bodyType = "Traveller";
  else if (/\bVan\b/i.test(description)) bodyType = "Van";
  else if (/\bPick[- ]?Up\b|\bPick-?up\b/i.test(description)) bodyType = "Pick-Up";
  else if (/\bEstate\b/i.test(description)) bodyType = "Estate";
  else if (/\bClubman\b/i.test(description)) bodyType = "Clubman";
  else if (/\bCooper\b/i.test(description)) bodyType = "Cooper";

  const fits = [bodyType, mark].filter(Boolean).join(", ") || "All";
  return { bodyType, mark, hand, fits };
}

const generatedMiniIds = new Map(
  generatedMiniProducts.map((product) => [`${product.section}|${product.code}`.toLowerCase(), product.id])
);

function miniProductId(section: string, code: string, index: number, usedIds: Set<string>) {
  const known = generatedMiniIds.get(`${section}|${code}`.toLowerCase());
  const base = known || `mini-${slug(`${section}-${code}`, `upload-${index + 1}`)}`;
  let id = base;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  return id;
}

function parseMiniWorkbook(workbook: XLSX.WorkBook): ParsedCatalogueUpload {
  const out: Product[] = [];
  const seen = new Set<string>();
  const usedIds = new Set<string>();
  const warnings: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const numbered = sheetName.match(/^(\d+)B$/i);
    const appendix = sheetName.match(/^APX([12])$/i);
    if (!numbered && !appendix) continue;

    const section = numbered ? numbered[1] : `Apx${appendix![1]}`;
    const rows = rowsFromSheet(workbook.Sheets[sheetName]);
    if (!rows.length) continue;

    let pairs = findCodeDescColumns(rows[0]);
    if (!pairs.length) {
      pairs = appendix
        ? [
            { codeIndex: 1, descIndex: 2 },
            { codeIndex: 7, descIndex: 8 },
            { codeIndex: 0, descIndex: 1 },
            { codeIndex: 4, descIndex: 5 },
          ]
        : [
            { codeIndex: 1, descIndex: 2 },
            { codeIndex: 7, descIndex: 8 },
          ];
      warnings.push(`${sheetName}: used fallback column positions because no Code header was found.`);
    }

    for (const pair of pairs) {
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const code = cleanText(row[pair.codeIndex], 80);
        const name = cleanText(row[pair.descIndex], 500);
        if (!code || !name || !looksLikePartCode(code)) continue;

        const key = `${section}|${code}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const exCell = priceOrNull(row[pair.descIndex + 1]);
        const incCell = priceOrNull(row[pair.descIndex + 2]);
        const priceExVat = exCell ?? (incCell !== null ? round2(incCell / VAT_RATE) : null);
        const priceIncVat = incCell ?? (priceExVat !== null ? round2(priceExVat * VAT_RATE) : null);
        const parsed = parseMiniDescription(name);

        out.push({
          ...{ drawingRef: cleanText(row[pair.codeIndex - 1], 30), pdfColumn: pairs.indexOf(pair),
            pdfExVat: typeof row[pair.descIndex + 1] === "number" ? `\u00a3${Number(row[pair.descIndex + 1]).toFixed(2)}` : cleanText(row[pair.descIndex + 1], 80),
            pdfIncVat: typeof row[pair.descIndex + 2] === "number" ? `\u00a3${Number(row[pair.descIndex + 2]).toFixed(2)}` : cleanText(row[pair.descIndex + 2], 80) },
          id: miniProductId(section, code, out.length, usedIds),
          code,
          name,
          section,
          fits: parsed.fits,
          bodyType: parsed.bodyType,
          mark: parsed.mark,
          hand: parsed.hand,
          priceExVat,
          priceIncVat,
          stock: "in",
          stockQty: 0,
          category: "mini",
        });
      }
    }
  }

  if (!out.length) {
    throw new Error("No Mini catalogue lines were found. Upload the customer-facing Mini catalogue workbook.");
  }

  return { catalogue: "mini", products: out, warnings };
}

function categoryFromMetalSheet(name: string) {
  const n = name.trim().toLowerCase();
  if (n === "steel tube") return "steel_tube";
  if (n === "silver steel") return "silver_steel";
  if (n.includes("gauge plate")) return "gauge_plate";
  if (n.includes("nickel silver") || n.includes("nil ag")) return "nickel_silver";
  if (n === "lg") return "leaded_gunmetal";
  if (n.startsWith("pb") || n === "colphos") return "phosphor_bronze";
  if (n.includes("alu bronze") || n.includes("magn bronz")) return "aluminium_bronze_manganese_bronze";
  if (n.startsWith("alu")) return "aluminium";
  if (n.startsWith("brass")) return "brass";
  if (n.startsWith("copper")) return "copper";
  if (n.includes("cast")) return "cast_iron";
  if (n.includes("plastic")) return "plastics";
  if (n.includes("stainless") || n.startsWith("st steel") || n.startsWith("st st")) return "stainless_steel";
  if (n.startsWith("steel")) return "steel";
  return "steel";
}

function metalSignature(sourceSheet: string, shape: string, metal: string, spec: string, size: string, unit: string) {
  return [sourceSheet, shape, metal, spec, size, unit].map(normaliseKey).join("|");
}

const generatedMetalIds = new Map(
  generatedMetals.map((product) => [
    metalSignature(product.sourceSheet, product.form, product.metal, product.spec, product.size, product.unit),
    product.id,
  ])
);

function metalProductId(signature: string, code: string, index: number, usedIds: Set<string>) {
  const known = generatedMetalIds.get(signature);
  const base = known || `metal-${slug(code, `upload-${index + 1}`)}`;
  let id = base;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  return id;
}

function metalCode(shape: string, metal: string, spec: string, size: string, index: number) {
  const pieces = [spec || metal || shape, size].filter(Boolean).join("-");
  const clean = pieces
    .replace(/\u00d7/g, "x")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9./"_+-]+/g, "")
    .slice(0, 80);
  return clean || `METAL-${String(index + 1).padStart(4, "0")}`;
}

function findHeaderIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const headers = row.slice(0, 8).map((cell) => cleanText(cell).toLowerCase());
    return headers[0] === "shape" && headers[1] === "metal" && headers[3] === "size";
  });
}

function buildMetalLookup(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets._PriceLookup;
  if (!sheet) return new Map<string, { stockSize: string; code: string; priceExVat: number | null }>();

  const rows = rowsFromSheet(sheet);
  if (!rows.length) return new Map<string, { stockSize: string; code: string; priceExVat: number | null }>();

  const header = rows[0].map((cell) => cleanText(cell).toLowerCase());
  const stableLinkIndex = header.findIndex((cell) => cell.includes("stable link"));
  const stockIndex = header.findIndex((cell) => cell.includes("stock length"));
  const codeIndex = header.findIndex((cell) => cell === "code");
  const priceIndex = header.findIndex((cell) => cell.includes("ex vat"));
  const map = new Map<string, { stockSize: string; code: string; priceExVat: number | null }>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const keys = [
      cleanText(row[0], 500),
      stableLinkIndex >= 0 ? cleanText(row[stableLinkIndex], 500) : "",
    ].filter(Boolean);
    const value = {
      stockSize: stockIndex >= 0 ? cleanText(row[stockIndex], 120) : "",
      code: codeIndex >= 0 ? cleanText(row[codeIndex], 120) : "",
      priceExVat: priceIndex >= 0 ? priceOrNull(row[priceIndex]) : null,
    };
    keys.forEach((key) => map.set(key, value));
  }

  return map;
}

function parseMetalsWorkbook(workbook: XLSX.WorkBook): ParsedCatalogueUpload {
  const out: MetalProduct[] = [];
  const usedIds = new Set<string>();
  const warnings: string[] = [];
  const lookup = buildMetalLookup(workbook);

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.startsWith("_")) continue;
    const rows = rowsFromSheet(workbook.Sheets[sheetName]);
    const headerIndex = findHeaderIndex(rows);
    if (headerIndex < 0) continue;

    const category = categoryFromMetalSheet(sheetName);

    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const shape = cleanText(row[0], 120);
      const metal = cleanText(row[1], 120);
      const spec = cleanText(row[2], 120);
      const size = cleanText(row[3], 240);
      const unit = cleanText(row[5], 120);
      if (!metal && !size) continue;

      const lookupKey = cleanText(row[10], 500);
      const lookupValue = lookupKey ? lookup.get(lookupKey) : undefined;
      const priceExVat = lookupValue?.priceExVat ?? priceOrNull(row[4]);
      const priceIncVat = priceExVat === null ? null : round2(priceExVat * VAT_RATE);
      const code = cleanText(row[7], 120) || lookupValue?.code || metalCode(shape, metal, spec, size, out.length);
      const signature = metalSignature(sheetName, shape, metal, spec, size, unit);
      const stockSize = lookupValue?.stockSize || cleanText(row[12], 120);
      const name = [shape, metal, spec, size].filter(Boolean).join(" — ");

      out.push({
        id: metalProductId(signature, code, out.length, usedIds),
        code,
        name,
        category,
        metal,
        form: shape,
        stock: "in",
        priceExVat,
        priceIncVat,
        unit,
        spec,
        size,
        stockSize,
        notes: "",
        sourceSheet: sheetName,
        pricePerKg: priceExVat,
        description: spec || name,
      });
    }
  }

  if (!out.length) {
    throw new Error("No metals catalogue lines were found. Upload the customer-facing Metals Catalogue workbook.");
  }

  if (!lookup.size) {
    warnings.push("No hidden stock-size lookup sheet was found, so maximum cut lengths will only be enforced where the catalogue itself contains a stock size.");
  }

  return { catalogue: "metals", products: out, warnings };
}

export function parseUploadedCatalogue(catalogue: CatalogueUploadKind, bytes: Uint8Array): ParsedCatalogueUpload {
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: false,
    cellNF: false,
    cellStyles: false,
    bookVBA: false,
  });

  const hasMiniSections = workbook.SheetNames.some((name) => /^\d{3}B$/i.test(name));
  if (catalogue === "metals" && hasMiniSections) {
    throw new Error("This is a Mini panels workbook. Drop it into the Mini panels box instead. Nothing has been updated.");
  }
  if (catalogue === "mini" && !hasMiniSections) {
    throw new Error("This does not contain the Mini catalogue section sheets. Check that you selected the Mini panels workbook. Nothing has been updated.");
  }

  return catalogue === "mini" ? parseMiniWorkbook(workbook) : parseMetalsWorkbook(workbook);
}
