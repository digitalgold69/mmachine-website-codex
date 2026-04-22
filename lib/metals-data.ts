// Engineering metals catalogue
// TODO: Replace with parsed data from the metals catalogue PDF when user sends it

export type MetalProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  form: string;
  stock: "in" | "low" | "out";
  pricePerKg: number | null;
  description: string;
};

export const metalCategories = [
  { key: "tool_steel", label: "Tool steels" },
  { key: "mild_steel", label: "Mild / carbon steel" },
  { key: "stainless", label: "Stainless steel" },
  { key: "aluminium", label: "Aluminium" },
  { key: "brass", label: "Brass" },
  { key: "bronze", label: "Bronze" },
];

export const metals: MetalProduct[] = [
  { id: "m001", code: "EN24T", name: "EN24T tool steel", category: "tool_steel", form: "Round bar", stock: "in", pricePerKg: 12.40, description: "Hardened & tempered tool steel. Available in multiple diameters." },
  { id: "m002", code: "EN1A", name: "EN1A free-cutting steel", category: "mild_steel", form: "Round bar", stock: "in", pricePerKg: 4.80, description: "Free-cutting mild steel. Excellent machinability." },
  { id: "m003", code: "EN8", name: "EN8 medium carbon steel", category: "mild_steel", form: "Round & square", stock: "in", pricePerKg: 3.90, description: "Medium carbon steel — general purpose." },
  { id: "m004", code: "EN3B", name: "EN3B mild steel", category: "mild_steel", form: "Round, square, flat", stock: "in", pricePerKg: 3.20, description: "Standard mild steel for general fabrication." },
  { id: "m005", code: "EN36", name: "EN36 case-hardening steel", category: "tool_steel", form: "Round bar", stock: "in", pricePerKg: 14.80, description: "Nickel-chrome case-hardening steel." },
  { id: "m006", code: "O1", name: "O1 oil-hardening tool steel", category: "tool_steel", form: "Ground flat", stock: "in", pricePerKg: 16.90, description: "Oil-hardening tool steel. Ground flat stock." },
  { id: "m007", code: "D2", name: "D2 air-hardening tool steel", category: "tool_steel", form: "Round & flat", stock: "in", pricePerKg: 19.50, description: "High-chromium cold-work tool steel." },
  { id: "m008", code: "316", name: "316 stainless steel", category: "stainless", form: "Sheet, bar, tube", stock: "in", pricePerKg: 18.20, description: "Marine-grade austenitic stainless steel." },
  { id: "m009", code: "304", name: "304 stainless steel", category: "stainless", form: "Sheet, bar, tube", stock: "in", pricePerKg: 14.60, description: "Standard food-grade stainless steel." },
  { id: "m010", code: "303", name: "303 free-machining stainless", category: "stainless", form: "Round bar", stock: "in", pricePerKg: 16.40, description: "Free-machining stainless steel." },
  { id: "m011", code: "6082-T6", name: "6082-T6 aluminium alloy", category: "aluminium", form: "Plate, bar", stock: "in", pricePerKg: 9.40, description: "Structural aluminium. Excellent corrosion resistance." },
  { id: "m012", code: "6063", name: "6063 aluminium", category: "aluminium", form: "Extruded sections", stock: "in", pricePerKg: 8.80, description: "Architectural aluminium extrusions." },
  { id: "m013", code: "2011", name: "2011 aluminium free-machining", category: "aluminium", form: "Round bar", stock: "low", pricePerKg: 11.10, description: "Free-machining aluminium." },
  { id: "m014", code: "7075-T6", name: "7075-T6 aluminium alloy", category: "aluminium", form: "Plate, bar", stock: "in", pricePerKg: 15.50, description: "Aerospace-grade high-strength aluminium." },
  { id: "m015", code: "CZ121", name: "CZ121 brass", category: "brass", form: "Round & hex bar", stock: "in", pricePerKg: 13.80, description: "Free-cutting brass." },
  { id: "m016", code: "CZ108", name: "CZ108 cartridge brass", category: "brass", form: "Sheet & strip", stock: "in", pricePerKg: 14.20, description: "Cold-working cartridge brass." },
  { id: "m017", code: "PB102", name: "PB102 phosphor bronze", category: "bronze", form: "Round bar", stock: "in", pricePerKg: 22.50, description: "Phosphor bronze. Excellent for bearings and bushes." },
  { id: "m018", code: "SAE660", name: "SAE660 gunmetal bronze", category: "bronze", form: "Round bar", stock: "in", pricePerKg: 21.80, description: "Leaded gunmetal bronze." },
];
