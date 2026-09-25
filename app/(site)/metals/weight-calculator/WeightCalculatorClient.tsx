"use client";

import { useMemo, useState } from "react";

type UnitSystem = "Metric" | "Imperial";
type MaterialKey = "Steel" | "Aluminium" | "Stainless" | "Cast Iron" | "Brass" | "Copper";
type ShapeKey = "Round" | "Square" | "Rectangle" | "Hexagon" | "Sheet" | "Tube" | "Box" | "Angle";

type FieldKey = "param1" | "param2" | "param3";

type ShapeConfig = {
  label: ShapeKey;
  fields: Partial<Record<FieldKey, string>>;
  help: string;
};

type ParsedDimension = {
  value: number;
  display: string;
};

type CalculationResult = {
  kg: number;
  measurements: Array<{ label: string; display: string }>;
};

const materials: Array<{ key: MaterialKey; label: string; factor: number }> = [
  { key: "Steel", label: "Steel", factor: 1 },
  { key: "Aluminium", label: "Aluminium", factor: 0.3462 },
  { key: "Stainless", label: "Stainless", factor: 1.03 },
  { key: "Cast Iron", label: "Cast Iron", factor: 0.911 },
  { key: "Brass", label: "Brass", factor: 1.084 },
  { key: "Copper", label: "Copper", factor: 1.144 },
];

const shapes: Record<ShapeKey, ShapeConfig> = {
  Round: {
    label: "Round",
    fields: { param1: "Diameter", param3: "Length" },
    help: "Solid round bar.",
  },
  Square: {
    label: "Square",
    fields: { param1: "Width", param3: "Length" },
    help: "Solid square bar.",
  },
  Rectangle: {
    label: "Rectangle",
    fields: { param1: "Thickness", param2: "Width", param3: "Length" },
    help: "Solid rectangular flat bar.",
  },
  Hexagon: {
    label: "Hexagon",
    fields: { param1: "Across flats", param3: "Length" },
    help: "Solid hexagon bar measured across flats.",
  },
  Sheet: {
    label: "Sheet",
    fields: { param1: "Thickness", param2: "Width", param3: "Length" },
    help: "Sheet or plate.",
  },
  Tube: {
    label: "Tube",
    fields: { param1: "Outside diameter", param2: "Wall thickness", param3: "Length" },
    help: "Round tube.",
  },
  Box: {
    label: "Box",
    fields: { param1: "Outside width", param2: "Wall thickness", param3: "Length" },
    help: "Square box section.",
  },
  Angle: {
    label: "Angle",
    fields: { param1: "Outside width", param2: "Wall thickness", param3: "Length" },
    help: "Equal angle section.",
  },
};

const shapeOrder = Object.keys(shapes) as ShapeKey[];

const unicodeFractions: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

function cleanVisibleInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatDimensionEcho(value: string, units: UnitSystem) {
  const visible = cleanVisibleInput(value);
  if (units === "Metric") return `${visible} mm`;
  return /(?:["”″]|\bin(?:ch(?:es)?|s)?\.?\s*)$/i.test(visible) ? visible : `${visible} in`;
}

function normaliseImperialInput(value: string) {
  let text = value.trim();
  for (const [glyph, replacement] of Object.entries(unicodeFractions)) {
    text = text.replaceAll(glyph, ` ${replacement}`);
  }

  return text
    .replace(/[“”″"]/g, "")
    .replace(/\s*(?:inches|inch|ins|in)\.?\s*$/i, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFraction(numerator: string, denominator: string, label: string) {
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
    throw new Error(`Check the fraction entered for ${label.toLowerCase()}.`);
  }
  return top / bottom;
}

function parseImperialInches(value: string, label: string): ParsedDimension {
  if (!value.trim()) throw new Error(`Enter a value for ${label.toLowerCase()}.`);

  const cleaned = normaliseImperialInput(value);
  const display = formatDimensionEcho(value, "Imperial");

  if (/^(?:\d+|\d*\.\d+)$/.test(cleaned)) {
    return { value: Number(cleaned), display };
  }

  const mixedFraction = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    return {
      value: Number(mixedFraction[1]) + parseFraction(mixedFraction[2], mixedFraction[3], label),
      display,
    };
  }

  const simpleFraction = cleaned.match(/^(\d+)\/(\d+)$/);
  if (simpleFraction) {
    return { value: parseFraction(simpleFraction[1], simpleFraction[2], label), display };
  }

  throw new Error(`Use decimal inches or fractions such as 0.5, 1/2 or 1 1/2 for ${label.toLowerCase()}.`);
}

function parseDimensionInput(value: string, label: string, units: UnitSystem): ParsedDimension {
  if (units === "Imperial") return parseImperialInches(value, label);

  const cleaned = value.trim();
  if (!cleaned) throw new Error(`Enter a value for ${label.toLowerCase()}.`);
  if (!/^(?:\d+|\d*\.\d+)$/.test(cleaned)) throw new Error(`Check the value for ${label.toLowerCase()}.`);
  return { value: Number(cleaned), display: formatDimensionEcho(value, "Metric") };
}

function dimensionToInches(value: number, units: UnitSystem) {
  return units === "Metric" ? value / 25.4 : value;
}

function lengthToFeet(value: number, units: UnitSystem) {
  return units === "Metric" ? value / 25.4 / 12 : value / 12;
}

function kgFromPounds(value: number, divideAfterRounding = 1) {
  return Math.round(value * 0.4535 * 1000) / 1000 / divideAfterRounding;
}

function calculateWeightKg(input: {
  units: UnitSystem;
  material: MaterialKey;
  shape: ShapeKey;
  values: Record<FieldKey, string>;
}): CalculationResult {
  const shape = shapes[input.shape];
  const material = materials.find((item) => item.key === input.material) || materials[0];
  const parsed: Partial<Record<FieldKey, ParsedDimension>> = {};

  (["param1", "param2", "param3"] as FieldKey[]).forEach((key) => {
    const label = shape.fields[key];
    if (label) parsed[key] = parseDimensionInput(input.values[key], label, input.units);
  });

  const p1 = parsed.param1 ? dimensionToInches(parsed.param1.value, input.units) : 0;
  const p2 = parsed.param2 ? dimensionToInches(parsed.param2.value, input.units) : 0;
  const p3 = parsed.param3 ? lengthToFeet(parsed.param3.value, input.units) : 0;
  const factor = material.factor;
  const measurements = (["param1", "param2", "param3"] as FieldKey[])
    .filter((key) => Boolean(shape.fields[key] && parsed[key]))
    .map((key) => ({ label: shape.fields[key]!, display: parsed[key]!.display }));

  let kg = 0;
  switch (input.shape) {
    case "Round":
      kg = kgFromPounds(2.6729 * p1 * p1 * factor * p3);
      break;
    case "Square":
      kg = kgFromPounds(3.4032 * p1 * p1 * factor * p3);
      break;
    case "Hexagon":
      kg = kgFromPounds(2.9473 * p1 * p1 * factor * p3);
      break;
    case "Sheet":
    case "Rectangle":
      kg = kgFromPounds(3.4032 * p1 * factor * p2 * p3);
      break;
    case "Tube": {
      const pounds = 10.68 * (p1 - p2) * factor * p2 * p3;
      if (pounds < 0) throw new Error("The tube wall thickness cannot exceed the outside diameter.");
      kg = kgFromPounds(pounds);
      break;
    }
    case "Box": {
      const pounds = 15.541 * (p1 - p2 - p2) * factor * p2 * p3;
      if (pounds < 0) throw new Error("The box wall thickness cannot exceed the outside width.");
      kg = kgFromPounds(pounds);
      break;
    }
    case "Angle": {
      const pounds = 15.541 * (p1 - p2 - p2) * factor * p2 * p3;
      if (pounds < 0) throw new Error("The angle wall thickness cannot exceed the outside width.");
      kg = kgFromPounds(pounds, 2);
      break;
    }
    default:
      kg = 0;
  }

  return { kg, measurements };
}

export default function WeightCalculatorClient() {
  const [units, setUnits] = useState<UnitSystem>("Metric");
  const [material, setMaterial] = useState<MaterialKey>("Steel");
  const [shape, setShape] = useState<ShapeKey>("Round");
  const [values, setValues] = useState<Record<FieldKey, string>>({ param1: "", param2: "", param3: "" });
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState("");

  const config = shapes[shape];
  const unitLabel = units === "Metric" ? "mm" : "in";

  const visibleFields = useMemo(
    () => (["param1", "param2", "param3"] as FieldKey[]).filter((key) => Boolean(config.fields[key])),
    [config]
  );

  function updateShape(nextShape: ShapeKey) {
    setShape(nextShape);
    setValues({ param1: "", param2: "", param3: "" });
    setResult(null);
    setError("");
  }

  function calculate() {
    try {
      const next = calculateWeightKg({ units, material, shape, values });
      setResult(next);
      setError("");
    } catch (calculationError) {
      setResult(null);
      setError((calculationError as Error).message || "Check the dimensions and try again.");
    }
  }

  function reset() {
    setValues({ param1: "", param2: "", param3: "" });
    setResult(null);
    setError("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
      <form
        className="rounded-2xl border border-racing/10 bg-white p-5 shadow-sm sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          calculate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-racing">
            Measuring units
            <select
              value={units}
              onChange={(event) => {
                setUnits(event.target.value as UnitSystem);
                setResult(null);
                setError("");
              }}
              className="input mt-2"
            >
              <option value="Metric">Metric</option>
              <option value="Imperial">Imperial</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-racing">
            Material
            <select
              value={material}
              onChange={(event) => {
                setMaterial(event.target.value as MaterialKey);
                setResult(null);
              }}
              className="input mt-2"
            >
              {materials.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-racing">
            Shape
            <select
              value={shape}
              onChange={(event) => updateShape(event.target.value as ShapeKey)}
              className="input mt-2"
            >
              {shapeOrder.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-racing/10 bg-cream-dark/70 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-racing">{shape}</h2>
              <p className="text-sm text-ink-muted">{config.help}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-racing">
              {units === "Metric" ? "Dimensions in mm" : "Dimensions in inches"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {visibleFields.map((key) => {
              const label = config.fields[key]!;
              return (
                <label key={key} className="block text-sm font-semibold text-racing">
                  {label}
                  <div className="mt-2 flex rounded-md border border-racing/15 bg-white focus-within:ring-2 focus-within:ring-gold/40">
                    <input
                      inputMode={units === "Imperial" ? "text" : "decimal"}
                      value={values[key]}
                      placeholder={units === "Imperial" ? "e.g. 1 1/2" : undefined}
                      onChange={(event) => {
                        setValues((current) => ({ ...current, [key]: event.target.value }));
                        setResult(null);
                        setError("");
                      }}
                      className="min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-3 py-3 text-racing outline-none"
                    />
                    <span className="flex items-center rounded-r-md border-l border-racing/10 bg-cream px-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {unitLabel}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {units === "Imperial" && (
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              Imperial accepts decimal inches or fractions, for example <strong>0.5</strong>, <strong>1/2</strong> or <strong>1 1/2</strong>.
            </p>
          )}
        </div>

        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl border border-racing/10 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Approximate weight</div>
            <div className="mt-1 font-display text-3xl text-racing">
              {result === null ? "—" : `${result.kg.toLocaleString("en-GB", { maximumFractionDigits: 3 })} kg`}
            </div>
            {result && result.measurements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-ink-muted">
                {result.measurements.map((item) => (
                  <span key={`${item.label}-${item.display}`} className="rounded-full bg-cream px-2 py-1">
                    {item.label}: {item.display}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={reset} className="btn-secondary">
              Reset
            </button>
            <button type="submit" className="btn-primary">
              Calculate weight
            </button>
          </div>
        </div>
      </form>

      <aside className="rounded-2xl border border-racing/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-2xl text-racing">How to use it</h2>
        <div className="mt-4 space-y-4 text-sm leading-6 text-ink-muted">
          <p>
            Choose the units, material and shape, then enter the requested dimensions to estimate the approximate weight.
          </p>
          <p>
            Metric entries use millimetres for all dimensions including length. Imperial entries use inches for all dimensions including length, and can be typed as fractions such as 3/16 or 1 1/2.
          </p>
          <p>
            The result is approximate and should be used as a guide for carriage or handling, not as a certified material weight.
          </p>
        </div>
        <div className="mt-6 rounded-xl border border-gold/30 bg-cream-dark p-4 text-sm text-racing">
          Need help choosing a size or material? Call Metals &amp; Engineering on <strong>01325 381302</strong>.
        </div>
      </aside>
    </div>
  );
}
