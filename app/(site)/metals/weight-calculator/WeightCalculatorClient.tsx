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

function parseInput(value: string, label: string) {
  if (!value.trim()) throw new Error(`Enter a value for ${label.toLowerCase()}.`);
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) throw new Error(`Check the value for ${label.toLowerCase()}.`);
  return Number(value);
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
}) {
  const shape = shapes[input.shape];
  const material = materials.find((item) => item.key === input.material) || materials[0];
  const p1 = shape.fields.param1 ? dimensionToInches(parseInput(input.values.param1, shape.fields.param1), input.units) : 0;
  const p2 = shape.fields.param2 ? dimensionToInches(parseInput(input.values.param2, shape.fields.param2), input.units) : 0;
  const p3 = shape.fields.param3 ? lengthToFeet(parseInput(input.values.param3, shape.fields.param3), input.units) : 0;
  const factor = material.factor;

  switch (input.shape) {
    case "Round":
      return kgFromPounds(2.6729 * p1 * p1 * factor * p3);
    case "Square":
      return kgFromPounds(3.4032 * p1 * p1 * factor * p3);
    case "Hexagon":
      return kgFromPounds(2.9473 * p1 * p1 * factor * p3);
    case "Sheet":
    case "Rectangle":
      return kgFromPounds(3.4032 * p1 * factor * p2 * p3);
    case "Tube": {
      const pounds = 10.68 * (p1 - p2) * factor * p2 * p3;
      if (pounds < 0) throw new Error("The tube wall thickness cannot exceed the outside diameter.");
      return kgFromPounds(pounds);
    }
    case "Box": {
      const pounds = 15.541 * (p1 - p2 - p2) * factor * p2 * p3;
      if (pounds < 0) throw new Error("The box wall thickness cannot exceed the outside width.");
      return kgFromPounds(pounds);
    }
    case "Angle": {
      const pounds = 15.541 * (p1 - p2 - p2) * factor * p2 * p3;
      if (pounds < 0) throw new Error("The angle wall thickness cannot exceed the outside width.");
      return kgFromPounds(pounds, 2);
    }
    default:
      return 0;
  }
}

export default function WeightCalculatorClient() {
  const [units, setUnits] = useState<UnitSystem>("Metric");
  const [material, setMaterial] = useState<MaterialKey>("Steel");
  const [shape, setShape] = useState<ShapeKey>("Round");
  const [values, setValues] = useState<Record<FieldKey, string>>({ param1: "", param2: "", param3: "" });
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState("");

  const config = shapes[shape];
  const unitLabel = units === "Metric" ? "mm" : "inches";

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                      inputMode="decimal"
                      value={values[key]}
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
        </div>

        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-xl border border-racing/10 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Approximate weight</div>
            <div className="mt-1 font-display text-3xl text-racing">
              {result === null ? "—" : `${result.toLocaleString("en-GB", { maximumFractionDigits: 3 })} kg`}
            </div>
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
            Choose the units, material and shape, then enter the requested dimensions. The calculator uses the same formulas from the old M-Machine metals site.
          </p>
          <p>
            Metric entries use millimetres for all dimensions including length. Imperial entries use inches for all dimensions including length.
          </p>
          <p>
            The result is approximate and should be used as a guide for carriage or handling, not as a certified material weight.
          </p>
        </div>
        <div className="mt-6 rounded-xl border border-gold/30 bg-cream-dark p-4 text-sm text-racing">
          Need help choosing a size or material? Call Metals & Engineering on <strong>01325 381302</strong>.
        </div>
      </aside>
    </div>
  );
}
