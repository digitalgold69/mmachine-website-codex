import type { QuoteItem } from "@/lib/quote-types";

export const METAL_DIMENSION_DISCLAIMER =
  "Material dimensions are nominal and may vary slightly. Contact us before ordering for precision jobs. Cutting charges may apply.";

const VAT_RATE = 1.2;
const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8;
const MM_TO_FEET = 1 / MM_PER_FOOT;

type MetalPricingProduct = {
  id?: string;
  productId?: string;
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  metal?: string;
  form?: string;
  shape?: string;
  spec?: string;
  size?: string;
  unit?: string;
  stockSize?: string;
  priceExVat?: number | null;
  unitPriceExVat?: number | null;
  priceIncVat?: number | null;
  unitPriceIncVat?: number | null;
};

export type MetalDimensionInput = {
  unit?: MetalDimensionUnit | string | null;
  inputUnit?: MetalDimensionUnit | string | null;
  length?: number | string | null;
  width?: number | string | null;
  inputLength?: number | string | null;
  inputWidth?: number | string | null;
  lengthMm?: number | string | null;
  widthMm?: number | string | null;
};

export type MetalDimensionUnit = "metric" | "imperial";

export type MetalOrderConfig =
  | {
      mode: "length";
      unitLengthMm?: number;
      maxLengthMm?: number;
      unitLabel: string;
      stockSize: string;
    }
  | {
      mode: "sheet";
      unitAreaSqFt?: number;
      maxLengthMm?: number;
      maxWidthMm?: number;
      unitLabel: string;
      stockSize: string;
    }
  | {
      mode: "fixed";
      fixedLengthMm: number;
      unitLengthMm: number;
      unitLabel: string;
      stockSize: string;
      fixedKind: "silver-steel" | "metric-gauge-plate" | "imperial-gauge-plate";
    }
  | {
      mode: "catalogue";
      unitLabel: string;
      stockSize: string;
    }
  | {
      mode: "manual";
      reason: string;
    };

export type MetalOrderCalculation =
  | {
      ok: true;
      keySuffix: string;
      unit: string;
      unitPriceExVat: number | null;
      unitPriceIncVat: number | null;
      metalDimensions: NonNullable<QuoteItem["metalDimensions"]>;
    }
  | {
      ok: false;
      error: string;
    };

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyPrecision(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function moneyLineTotal(unitPrice: number | null | undefined, qty: number) {
  return typeof unitPrice === "number" ? moneyPrecision(unitPrice * Math.max(1, qty)) : null;
}

function normalise(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\u00d7/g, "x")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: unknown) {
  return normalise(value).toLowerCase().replace(/[^a-z0-9."]+/g, "");
}

function productText(product: MetalPricingProduct) {
  return [
    product.category,
    product.form,
    product.shape,
    product.metal,
    product.spec,
    product.size,
    product.unit,
    product.name,
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function productPriceExVat(product: MetalPricingProduct) {
  if (typeof product.priceExVat === "number") return product.priceExVat;
  if (typeof product.unitPriceExVat === "number") return product.unitPriceExVat;
  return null;
}

function parseFraction(value: string) {
  const raw = value.trim();
  const mixed = raw.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const compactMixed = raw.match(/^(\d+)(\d)\/(\d+)$/);
  if (compactMixed) return Number(compactMixed[1]) + Number(compactMixed[2]) / Number(compactMixed[3]);
  const fraction = raw.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function unitToken(value: string) {
  const raw = value.toLowerCase();
  if (raw.includes("mm")) return "mm";
  if (/cm\b/.test(raw)) return "cm";
  if (raw.includes('"') || /inch(?:es)?\b|in\b/.test(raw)) return "in";
  if (/ft\b|feet\b|foot\b/.test(raw)) return "ft";
  if (/\bmetre\b|\bmeter\b|\bmtr\b|(^|[^a-z])m($|[^a-z])/.test(raw)) return "m";
  return "";
}

function valueToMm(value: number, unit: string) {
  if (unit === "mm") return value;
  if (unit === "cm") return value * 10;
  if (unit === "m") return value * 1000;
  if (unit === "in") return value * MM_PER_INCH;
  if (unit === "ft") return value * MM_PER_FOOT;
  return null;
}

function parseDimensionSegment(segment: string, fallbackUnit = "") {
  const raw = normalise(segment);
  const valueMatch = raw.match(/(\d+(?:\.\d+)?\s+\d+\/\d+|\d+\d\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  if (!valueMatch) return null;
  const value = parseFraction(valueMatch[1]);
  if (value === null) return null;
  const unit = unitToken(raw) || fallbackUnit;
  if (!unit) return { value, unit: "", mm: null, raw };
  return { value, unit, mm: valueToMm(value, unit), raw };
}

function splitDimensionParts(value: string) {
  return normalise(value)
    .replace(/\s*[xX]\s*/g, "x")
    .split("x")
    .map((part) => part.trim())
    .filter(Boolean);
}

function neighbouringSheetUnit(parts: string[], index: number) {
  const next = parts.slice(index + 1).map(unitToken).find(Boolean);
  if (next) return next;
  return parts.slice(0, index).reverse().map(unitToken).find(Boolean) || "";
}

function parsedSheetDimensionToMm(
  parsed: NonNullable<ReturnType<typeof parseDimensionSegment>>,
  parts: string[],
  index: number,
  unitLabel = ""
) {
  if (parsed.mm) return parsed.mm;

  const neighbouringUnit = neighbouringSheetUnit(parts, index);
  if (neighbouringUnit === "ft" && parsed.value > 0 && parsed.value <= 30) {
    return valueToMm(parsed.value, neighbouringUnit);
  }
  if (neighbouringUnit === "in" && parsed.value > 0 && parsed.value <= 120) {
    return valueToMm(parsed.value, neighbouringUnit);
  }
  if (
    parts.every((part) => !unitToken(part)) &&
    /sq\.?\s*inch|square\s*inch|25\s*mm\s*sq/.test(normalise(unitLabel).toLowerCase()) &&
    parsed.value > 0 &&
    parsed.value <= 120
  ) {
    return valueToMm(parsed.value, "in");
  }
  if (parsed.value > 50) return parsed.value;
  if (parsed.value > 0 && parsed.value <= 10 && parsed.raw.includes(".")) return parsed.value * 1000;

  return null;
}

function parseSheetStock(stockSize: string, unitLabel = "") {
  const parts = splitDimensionParts(stockSize);
  if (parts.length < 2) return null;
  const first = parseDimensionSegment(parts[0]);
  const second = parseDimensionSegment(parts[1]);
  if (!first || !second) return null;

  if (
    parts.length === 2 &&
    !unitToken(parts[0]) &&
    unitToken(parts[1]) === "m" &&
    first.value >= 50 &&
    Math.abs(second.value - 1) < 0.001
  ) {
    return { lengthMm: 1000, widthMm: 1000 };
  }

  const firstMm = parsedSheetDimensionToMm(first, parts, 0, unitLabel);
  const secondMm = parsedSheetDimensionToMm(second, parts, 1, unitLabel);
  if (!firstMm || !secondMm) return null;
  return { lengthMm: firstMm, widthMm: secondMm };
}

function parseStockLength(stockSize: string) {
  const parts = splitDimensionParts(stockSize);
  if (parts.length === 0) return null;
  const parsedParts = parts.map((part) => parseDimensionSegment(part));
  const explicitLength = parsedParts.find((part) => part?.mm);
  if (explicitLength?.mm) return explicitLength.mm;
  const first = parsedParts[0];
  if (!first) return null;
  return first.value > 50 ? first.value : null;
}

function parseTextDimensionMm(value: string) {
  const parsed = parseDimensionSegment(value, "");
  return parsed?.mm ?? null;
}

function parseUnitLengthMm(unit: string | undefined) {
  const raw = normalise(unit).toLowerCase();
  if (!raw) return null;
  if (/300\s*mm/.test(raw) && /foot|ft/.test(raw)) return 300;
  if (/25\s*mm/.test(raw) && /inch|in\b/.test(raw)) return 25;
  const parenthesised = raw.match(/\(([^)]+)\)/);
  if (parenthesised) {
    const parsed = parseTextDimensionMm(parenthesised[1]);
    if (parsed) return parsed;
  }
  const afterSlash = raw.match(/\/\s*([0-9./\s]+(?:mm|cm|m|inches|inch|in|ft|feet|foot|"))/);
  if (afterSlash) {
    const parsed = parseTextDimensionMm(afterSlash[1]);
    if (parsed) return parsed;
  }
  const perUnit = raw.match(/\b(?:per|length)\s*([0-9./\s]+(?:mm|cm|m|inches|inch|in|ft|feet|foot|"))/);
  if (perUnit) {
    const parsed = parseTextDimensionMm(perUnit[1]);
    if (parsed) return parsed;
  }
  if (/^[0-9./\s]+(?:mm|cm|m|inches|inch|in|ft|feet|foot|")$/.test(raw)) {
    const parsed = parseTextDimensionMm(raw);
    if (parsed) return parsed;
  }
  if (/\bmetre\b|\bmeter\b|\bmtr\b/.test(raw)) return 1000;
  if (/\bfoot\b|\bft\b/.test(raw)) return 300;
  if (/\binch\b|\bin\b/.test(raw)) return 25;
  return null;
}

function parseAreaFromDimensions(value: string) {
  const dims = parseSheetStock(value);
  if (!dims) return null;
  return (dims.lengthMm * MM_TO_FEET) * (dims.widthMm * MM_TO_FEET);
}

function parseUnitAreaSqFt(unit: string | undefined) {
  const raw = normalise(unit).toLowerCase();
  if (!raw) return null;
  if (/1\s*\/\s*2\s*sq/.test(raw)) return 0.5;
  if (/sq\.?\s*inch|square\s*inch/.test(raw) || /25\s*mm\s*sq/.test(raw)) {
    return (25 * MM_TO_FEET) * (25 * MM_TO_FEET);
  }
  if (/sq\.?\s*ft|sq\.?\s*foot|square\s*foot|square\s*ft/.test(raw)) return 1;
  return parseAreaFromDimensions(raw);
}

function isSilverSteel(product: MetalPricingProduct) {
  const text = compact(productText(product));
  return text.includes("silversteel") || product.category === "silver_steel";
}

function isGaugePlate(product: MetalPricingProduct) {
  const text = compact(productText(product));
  return text.includes("gaugeplate") || product.category === "gauge_plate";
}

function isSheetLike(product: MetalPricingProduct) {
  const text = productText(product);
  if (isGaugePlate(product)) return false;
  return /\b(sheet|plate|shim|treadplate|floor plate|tooling plate|tool plate|tinplate)\b/i.test(text);
}

function isCatalogueUnit(unit: string) {
  return /\b(pack|box|set|pair|each)\b/i.test(unit);
}

function fixedLengthForGaugePlate(unitLengthMm: number | null, stockSize: string, unit: string | undefined) {
  const stockLength = parseStockLength(stockSize);
  if (stockLength && (!unitLengthMm || stockLength > unitLengthMm)) return stockLength;
  const rawUnit = normalise(unit).toLowerCase();
  if (/250\s*mm/.test(rawUnit)) return 500;
  if (/9\s*"/.test(rawUnit) || /9\s*inch/.test(rawUnit) || /9\s*in\b/.test(rawUnit)) return 18 * MM_PER_INCH;
  return unitLengthMm ? unitLengthMm * 2 : null;
}

export function getMetalOrderConfig(product: MetalPricingProduct): MetalOrderConfig {
  const hasNumericPrice = productPriceExVat(product) !== null;
  const stockSize = normalise(product.stockSize);
  const unit = normalise(product.unit);

  if (isCatalogueUnit(unit)) {
    return {
      mode: "catalogue",
      unitLabel: unit,
      stockSize,
    };
  }

  if (isSilverSteel(product)) {
    const unitLengthMm = parseUnitLengthMm(unit) || 13 * MM_PER_INCH;
    return {
      mode: "fixed",
      fixedKind: "silver-steel",
      fixedLengthMm: 13 * MM_PER_INCH,
      unitLengthMm,
      unitLabel: unit,
      stockSize,
    };
  }

  if (isGaugePlate(product)) {
    const unitLengthMm = parseUnitLengthMm(unit);
    const fixedLengthMm = fixedLengthForGaugePlate(unitLengthMm, stockSize, unit);
    if (!unitLengthMm || !fixedLengthMm) {
      return {
        mode: "catalogue",
        unitLabel: unit,
        stockSize,
      };
    }
    return {
      mode: "fixed",
      fixedKind: Math.abs(fixedLengthMm - 500) < 2 ? "metric-gauge-plate" : "imperial-gauge-plate",
      fixedLengthMm,
      unitLengthMm,
      unitLabel: unit,
      stockSize,
    };
  }

  if (isSheetLike(product)) {
    const unitAreaSqFt = parseUnitAreaSqFt(unit);
    const stock = parseSheetStock(stockSize, unit);
    if (!unitAreaSqFt && hasNumericPrice) {
      return {
        mode: "catalogue",
        unitLabel: unit,
        stockSize,
      };
    }
    return {
      mode: "sheet",
      ...(unitAreaSqFt ? { unitAreaSqFt } : {}),
      ...(stock
        ? {
            maxLengthMm: Math.max(stock.lengthMm, stock.widthMm),
            maxWidthMm: Math.min(stock.lengthMm, stock.widthMm),
          }
        : {}),
      unitLabel: unit,
      stockSize,
    };
  }

  const unitLengthMm = parseUnitLengthMm(unit);
  const maxLengthMm = stockSize ? parseStockLength(stockSize) : null;
  if (!unitLengthMm && hasNumericPrice) {
    return {
      mode: "catalogue",
      unitLabel: unit,
      stockSize,
    };
  }
  return {
    mode: "length",
    ...(unitLengthMm ? { unitLengthMm } : {}),
    ...(maxLengthMm ? { maxLengthMm } : {}),
    unitLabel: unit,
    stockSize,
  };
}

export function formatMm(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) return `${Math.round(rounded).toLocaleString("en-GB")}mm`;
  return `${rounded.toLocaleString("en-GB", { maximumFractionDigits: 1 })}mm`;
}

function formatFixedLength(mm: number) {
  const inches = mm / MM_PER_INCH;
  if (Math.abs(inches - Math.round(inches)) < 0.05) return `${Math.round(inches)} in`;
  return formatMm(mm);
}

function cleanDimension(value: unknown) {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  return parsed > 0 ? parsed : null;
}

export function normaliseMetalDimensionUnit(value: unknown): MetalDimensionUnit {
  return value === "imperial" ? "imperial" : "metric";
}

export function metalDimensionUnitLabel(unit: MetalDimensionUnit) {
  return unit === "imperial" ? "in" : "mm";
}

function metalDimensionUnitName(unit: MetalDimensionUnit) {
  return unit === "imperial" ? "inches" : "mm";
}

function dimensionInputToMm(value: number, unit: MetalDimensionUnit) {
  return unit === "imperial" ? value * MM_PER_INCH : value;
}

function formatDecimal(value: number, maximumFractionDigits = 3) {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function formatMetalDimensionForUnit(mm: number, unit: MetalDimensionUnit) {
  if (unit === "imperial") return `${formatDecimal(mm / MM_PER_INCH)} in`;
  return formatMm(mm);
}

type ResolvedDimension = {
  mm: number | null;
  unit: MetalDimensionUnit;
  inputValue: number | null;
};

function resolveDimensionInput(
  input: MetalDimensionInput,
  kind: "length" | "width"
): ResolvedDimension {
  const unit = normaliseMetalDimensionUnit(input.inputUnit ?? input.unit);
  const inputKey = kind === "length" ? "inputLength" : "inputWidth";
  const shortKey = kind;
  const mmKey = kind === "length" ? "lengthMm" : "widthMm";
  const inputValue = cleanDimension(input[inputKey] ?? input[shortKey]);
  if (inputValue !== null) {
    return {
      mm: dimensionInputToMm(inputValue, unit),
      unit,
      inputValue,
    };
  }

  const mmValue = cleanDimension(input[mmKey]);
  if (mmValue !== null) {
    return {
      mm: mmValue,
      unit,
      inputValue: unit === "imperial" ? mmValue / MM_PER_INCH : mmValue,
    };
  }

  return { mm: null, unit, inputValue: null };
}

function displayDimension(dimension: ResolvedDimension) {
  if (dimension.mm === null) return "";
  if (dimension.inputValue !== null) {
    return `${formatDecimal(dimension.inputValue)} ${metalDimensionUnitLabel(dimension.unit)}`;
  }
  return formatMetalDimensionForUnit(dimension.mm, dimension.unit);
}

function dimensionsFitSheet(lengthMm: number, widthMm: number, config: Extract<MetalOrderConfig, { mode: "sheet" }>) {
  if (typeof config.maxLengthMm !== "number" || typeof config.maxWidthMm !== "number") return true;
  const longer = Math.max(lengthMm, widthMm);
  const shorter = Math.min(lengthMm, widthMm);
  return longer <= config.maxLengthMm + 0.001 && shorter <= config.maxWidthMm + 0.001;
}

export function calculateMetalOrderItem(
  product: MetalPricingProduct,
  input: MetalDimensionInput,
  qty: number
): MetalOrderCalculation {
  const priceExVat = productPriceExVat(product);
  const config = getMetalOrderConfig(product);
  const safeQty = Math.max(1, Math.min(999, Math.floor(Number(qty) || 1)));

  if (config.mode === "manual") {
    return { ok: false, error: config.reason };
  }

  if (config.mode === "catalogue") {
    return { ok: false, error: "This item is sold as its catalogue unit." };
  }

  if (config.mode === "fixed") {
    const multiplier = config.fixedLengthMm / config.unitLengthMm;
    const unitPriceExVat = priceExVat === null ? null : moneyPrecision(priceExVat * multiplier);
    const display = config.fixedKind === "silver-steel"
      ? 'Sold as pre-cut 13" Lengths'
      : `Complete ${formatFixedLength(config.fixedLengthMm)} length`;
    return {
      ok: true,
      keySuffix: `fixed-${Math.round(config.fixedLengthMm * 10)}`,
      unit: "length",
      unitPriceExVat,
      unitPriceIncVat: unitPriceExVat === null ? null : moneyPrecision(unitPriceExVat * VAT_RATE),
      metalDimensions: {
        mode: "fixed",
        lengthMm: moneyPrecision(config.fixedLengthMm),
        display,
        pricedFromUnit: config.unitLabel,
        stockSize: config.stockSize,
      },
    };
  }

  const lengthDimension = resolveDimensionInput(input, "length");
  const lengthMm = lengthDimension.mm;
  if (!lengthMm) {
    return { ok: false, error: `Enter the required length in ${metalDimensionUnitName(lengthDimension.unit)}.` };
  }

  if (config.mode === "length") {
    if (typeof config.maxLengthMm === "number" && lengthMm > config.maxLengthMm + 0.001) {
      return {
        ok: false,
        error: `Maximum single length is ${formatMetalDimensionForUnit(config.maxLengthMm, lengthDimension.unit)}. Add separate lines for shorter pieces.`,
      };
    }
    const unitPriceExVat = priceExVat === null || !config.unitLengthMm
      ? null
      : moneyPrecision(priceExVat * (lengthMm / config.unitLengthMm));
    const display = `Length ${displayDimension(lengthDimension)}`;
    return {
      ok: true,
      keySuffix: `length-${Math.round(lengthMm * 10)}`,
      unit: "length",
      unitPriceExVat,
      unitPriceIncVat: unitPriceExVat === null ? null : moneyPrecision(unitPriceExVat * VAT_RATE),
      metalDimensions: {
        mode: "length",
        lengthMm: moneyPrecision(lengthMm),
        inputUnit: lengthDimension.unit,
        ...(lengthDimension.inputValue !== null ? { inputLength: moneyPrecision(lengthDimension.inputValue) } : {}),
        display,
        pricedFromUnit: config.unitLabel,
        stockSize: config.stockSize,
      },
    };
  }

  const widthDimension = resolveDimensionInput(input, "width");
  const widthMm = widthDimension.mm;
  if (!widthMm) {
    return { ok: false, error: `Enter the required width in ${metalDimensionUnitName(widthDimension.unit)}.` };
  }
  if (!dimensionsFitSheet(lengthMm, widthMm, config)) {
    return {
      ok: false,
      error: `Maximum sheet size is ${formatMetalDimensionForUnit(config.maxLengthMm!, lengthDimension.unit)} x ${formatMetalDimensionForUnit(config.maxWidthMm!, lengthDimension.unit)}.`,
    };
  }

  const areaSqFt = (lengthMm * MM_TO_FEET) * (widthMm * MM_TO_FEET);
  const unitPriceExVat = priceExVat === null || !config.unitAreaSqFt
    ? null
    : moneyPrecision(priceExVat * (areaSqFt / config.unitAreaSqFt));
  const display = `${displayDimension(lengthDimension)} x ${displayDimension(widthDimension)}`;
  return {
    ok: true,
    keySuffix: `sheet-${Math.round(lengthMm * 10)}x${Math.round(widthMm * 10)}`,
    unit: "piece",
    unitPriceExVat,
    unitPriceIncVat: unitPriceExVat === null ? null : moneyPrecision(unitPriceExVat * VAT_RATE),
    metalDimensions: {
      mode: "sheet",
      lengthMm: moneyPrecision(lengthMm),
      widthMm: moneyPrecision(widthMm),
      inputUnit: lengthDimension.unit,
      ...(lengthDimension.inputValue !== null ? { inputLength: moneyPrecision(lengthDimension.inputValue) } : {}),
      ...(widthDimension.inputValue !== null ? { inputWidth: moneyPrecision(widthDimension.inputValue) } : {}),
      display,
      pricedFromUnit: config.unitLabel,
      stockSize: config.stockSize,
    },
  };
}

export function metalOrderNeedsDimensions(product: MetalPricingProduct) {
  const config = getMetalOrderConfig(product);
  return config.mode === "length" || config.mode === "sheet";
}
