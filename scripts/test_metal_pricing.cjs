const assert = require("node:assert/strict");
const path = require("node:path");

const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, ".."),
  },
  cache: false,
});

const {
  calculateMetalOrderItem,
  getMetalOrderConfig,
  metalOrderNeedsDimensions,
  moneyLineTotal,
} = jiti("../lib/metal-pricing.ts");
const {
  buildMetalShapeFilters,
  metalShapeKey,
} = jiti("../lib/metals-filters.ts");

function assertClose(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 0.00001, `${label}: expected ${expected}, got ${actual}`);
}

assert.equal(metalShapeKey("Flat & Angle"), "flat_and_angle");
assert.deepEqual(
  buildMetalShapeFilters([
    { form: "Round" },
    { form: "Flat" },
    { form: "Round" },
  ]),
  [
    { key: "round", label: "Round", count: 2 },
    { key: "flat", label: "Flat", count: 1 },
  ],
  "metal shape filters should preserve catalogue order and counts"
);

const per300Product = {
  id: "length-300",
  category: "aluminium",
  form: "Flat",
  metal: "Aluminium",
  spec: "HE30",
  size: "1/2in x 1/8in",
  unit: "foot/300mm",
  stockSize: "6M x 5",
  priceExVat: 14,
};

assert.equal(getMetalOrderConfig(per300Product).mode, "length");
const per300 = calculateMetalOrderItem(per300Product, { lengthMm: 600 }, 3);
assert.equal(per300.ok, true);
assertClose(per300.unitPriceExVat, 28, "600mm from 300mm rate");
assertClose(moneyLineTotal(per300.unitPriceExVat, 3), 84, "600mm x 3 total");

const per300Imperial = calculateMetalOrderItem(per300Product, { inputUnit: "imperial", inputLength: 12 }, 1);
assert.equal(per300Imperial.ok, true);
assertClose(per300Imperial.metalDimensions.lengthMm, 304.8, "12in canonical mm");
assertClose(per300Imperial.unitPriceExVat, 14.224, "12in from 300mm rate");
assert.equal(per300Imperial.metalDimensions.display, "Length 12 in");

const per25Product = {
  id: "length-25",
  category: "brass",
  form: "Round",
  metal: "Brass",
  spec: "CZ121",
  size: "1/4in dia",
  unit: "inch/25mm",
  stockSize: "10ft x 50",
  priceExVat: 1,
};

const per25 = calculateMetalOrderItem(per25Product, { lengthMm: 50 }, 20);
assert.equal(per25.ok, true);
assertClose(per25.unitPriceExVat, 2, "50mm from 25mm rate");
assertClose(moneyLineTotal(per25.unitPriceExVat, 20), 40, "50mm x 20 total");

const sheetProduct = {
  id: "sheet",
  category: "steel",
  form: "Sheet",
  metal: "Mild Steel",
  spec: "CR4",
  size: "3mm",
  unit: "Sq. ft (300 mm sq.)",
  stockSize: "2500 x 1250 x 7",
  priceExVat: 11.5,
};

const sheet = calculateMetalOrderItem(sheetProduct, { lengthMm: 884, widthMm: 30 }, 2);
assert.equal(sheet.ok, true);
const expectedSheetUnit = 11.5 * (884 / 304.8) * (30 / 304.8);
assertClose(sheet.unitPriceExVat, Number(expectedSheetUnit.toFixed(6)), "sheet exact area unit price");
assertClose(
  moneyLineTotal(sheet.unitPriceExVat, 2),
  Number((expectedSheetUnit * 2).toFixed(6)),
  "sheet exact area total"
);

const imperialSheet = calculateMetalOrderItem(sheetProduct, { inputUnit: "imperial", inputLength: 10, inputWidth: 2 }, 1);
assert.equal(imperialSheet.ok, true);
assertClose(imperialSheet.metalDimensions.lengthMm, 254, "10in sheet canonical length");
assertClose(imperialSheet.metalDimensions.widthMm, 50.8, "2in sheet canonical width");
const expectedImperialSheet = 11.5 * (10 / 12) * (2 / 12);
assertClose(imperialSheet.unitPriceExVat, Number(expectedImperialSheet.toFixed(6)), "imperial sheet exact area unit price");
assert.equal(imperialSheet.metalDimensions.display, "10 in x 2 in");

const metreStockSheet = calculateMetalOrderItem(
  {
    id: "metre-stock-sheet",
    category: "aluminium",
    form: "Sheet",
    metal: "Aluminium",
    spec: "1050",
    size: "1mm",
    unit: "Sq. ft (300 mm sq.)",
    stockSize: "2.5 x 1.25 X 2",
    priceExVat: 4,
  },
  { lengthMm: 1250, widthMm: 500 },
  1
);
assert.equal(metreStockSheet.ok, true);
assertClose(metreStockSheet.unitPriceExVat, Number((4 * (1250 / 304.8) * (500 / 304.8)).toFixed(6)), "metre-style sheet stock parses as metres");
const metreStockSheetConfig = getMetalOrderConfig({
  id: "metre-stock-sheet",
  category: "aluminium",
  form: "Sheet",
  metal: "Aluminium",
  spec: "1050",
  size: "1mm",
  unit: "Sq. ft (300 mm sq.)",
  stockSize: "2.5 x 1.25 X 2",
  priceExVat: 4,
});
assert.equal(metreStockSheetConfig.mode, "sheet");
assertClose(metreStockSheetConfig.maxLengthMm, 2500, "metre-style sheet max length");
assertClose(metreStockSheetConfig.maxWidthMm, 1250, "metre-style sheet max width");

const mixedUnitSheetConfig = getMetalOrderConfig({
  id: "mixed-unit-sheet",
  category: "aluminium",
  form: "Sheet",
  metal: "Aluminium",
  spec: "C250",
  size: "16mm",
  unit: "Sq. ft (300 mm sq.)",
  stockSize: "4M X 510",
  priceExVat: 60,
});
assert.equal(mixedUnitSheetConfig.mode, "sheet");
assertClose(mixedUnitSheetConfig.maxLengthMm, 4000, "explicit metres with unitless mm width max length");
assertClose(mixedUnitSheetConfig.maxWidthMm, 510, "explicit metres with unitless mm width max width");

const feetSheetConfig = getMetalOrderConfig({
  id: "feet-sheet",
  category: "nickel_silver",
  form: "Sheet",
  metal: "Nickel Silver",
  spec: "NS103",
  size: "14swg",
  unit: "1/2 sq foot",
  stockSize: "6 X 1 FTx 3",
  priceExVat: 28.5,
});
assert.equal(feetSheetConfig.mode, "sheet");
assertClose(feetSheetConfig.maxLengthMm, 1828.8, "unitless feet shorthand max length");
assertClose(feetSheetConfig.maxWidthMm, 304.8, "unitless feet shorthand max width");

const treadplateSheetConfig = getMetalOrderConfig({
  id: "treadplate-sheet",
  category: "aluminium",
  form: "Sheet",
  metal: "Aluminium",
  spec: "5/Bar",
  size: "Treadplate 2mm",
  unit: "Sq. ft (300 mm sq.)",
  stockSize: "8 x 4ft x 2",
  priceExVat: 8.25,
});
assert.equal(treadplateSheetConfig.mode, "sheet");
assertClose(treadplateSheetConfig.maxLengthMm, 2438.4, "8ft shorthand max length");
assertClose(treadplateSheetConfig.maxWidthMm, 1219.2, "4ft shorthand max width");

const narrowShimConfig = getMetalOrderConfig({
  id: "narrow-shim",
  category: "stainless_steel",
  form: "Shim",
  metal: "Stainless Steel",
  spec: "",
  size: "0.25mm",
  unit: "150x300mm",
  stockSize: "150 x 1.25M X 5",
  priceExVat: 16.7,
});
assert.equal(narrowShimConfig.mode, "sheet");
assertClose(narrowShimConfig.maxLengthMm, 1250, "unitless mm with metre width max length");
assertClose(narrowShimConfig.maxWidthMm, 150, "unitless mm with metre width max width");

const inchSheetConfig = getMetalOrderConfig({
  id: "inch-sheet",
  category: "aluminium",
  form: "Sheet",
  metal: "Aluminium",
  spec: "5083",
  size: '1/2"',
  unit: "Sq. ft (300 mm sq.)",
  stockSize: '32 x 14"',
  priceExVat: 38.8,
});
assert.equal(inchSheetConfig.mode, "sheet");
assertClose(inchSheetConfig.maxLengthMm, 812.8, "unitless inch shorthand max length");
assertClose(inchSheetConfig.maxWidthMm, 355.6, "explicit inch shorthand max width");

const compactFractionInchSheetConfig = getMetalOrderConfig({
  id: "compact-fraction-inch-sheet",
  category: "copper",
  form: "Sheet",
  metal: "Copper",
  spec: "C101",
  size: "8mm",
  unit: "Sq. inch/25mm Sq",
  stockSize: "143/4 X 123/4",
  priceExVat: 1.48,
});
assert.equal(compactFractionInchSheetConfig.mode, "sheet");
assertClose(compactFractionInchSheetConfig.maxLengthMm, 374.65, "compact mixed fraction inch max length");
assertClose(compactFractionInchSheetConfig.maxWidthMm, 323.85, "compact mixed fraction inch max width");

const per25SqSheet = calculateMetalOrderItem(
  {
    id: "per-25-square-sheet",
    category: "aluminium",
    form: "Sheet",
    metal: "Aluminium",
    spec: "6082",
    size: "12.7mm",
    unit: "Sq. inch/25mm Sq",
    stockSize: '35" x 8"',
    priceExVat: 0.4,
  },
  { lengthMm: 50, widthMm: 25 },
  1
);
assert.equal(per25SqSheet.ok, true);
assertClose(per25SqSheet.unitPriceExVat, 0.8, "25mm square sheet rate uses exact area");

const navalBrass25SqSheet = calculateMetalOrderItem(
  {
    id: "naval-brass-25-square-sheet",
    category: "brass",
    form: "Sheet",
    metal: "Naval Brass",
    spec: "CZ112",
    size: "16mm",
    unit: "Sq inch/25mm sq",
    stockSize: "305 X 1M",
    priceExVat: 1.3,
  },
  { lengthMm: 50, widthMm: 50 },
  1
);
assert.equal(navalBrass25SqSheet.ok, true);
assertClose(navalBrass25SqSheet.unitPriceExVat, 5.2, "50mm x 50mm at 1.30 per 25mm square");
assertClose(navalBrass25SqSheet.unitPriceIncVat, 6.24, "50mm x 50mm at 1.30 per 25mm square inc VAT");
const navalBrass25SqSheetConfig = getMetalOrderConfig({
  id: "naval-brass-25-square-sheet",
  category: "brass",
  form: "Sheet",
  metal: "Naval Brass",
  spec: "CZ112",
  size: "16mm",
  unit: "Sq inch/25mm sq",
  stockSize: "305 X 1M",
  priceExVat: 1.3,
});
assert.equal(navalBrass25SqSheetConfig.mode, "sheet");
assertClose(navalBrass25SqSheetConfig.maxLengthMm, 1000, "stock count before 1m sheet is ignored");
assertClose(navalBrass25SqSheetConfig.maxWidthMm, 1000, "1m sheet stock count shorthand max width");
const overNavalBrass25SqSheet = calculateMetalOrderItem(
  {
    id: "naval-brass-25-square-sheet-over",
    category: "brass",
    form: "Sheet",
    metal: "Naval Brass",
    spec: "CZ112",
    size: "16mm",
    unit: "Sq inch/25mm sq",
    stockSize: "305 X 1M",
    priceExVat: 1.3,
  },
  { lengthMm: 1200, widthMm: 500 },
  1
);
assert.equal(overNavalBrass25SqSheet.ok, false);
assert.match(overNavalBrass25SqSheet.error, /Maximum sheet size/);

const metricGauge = calculateMetalOrderItem(
  {
    id: "metric-gauge",
    category: "gauge_plate",
    form: "Flat",
    metal: "Gauge Plate",
    spec: "Metric",
    size: "6mm",
    unit: "Length (250mm)",
    stockSize: "500mm x 2",
    priceExVat: 6,
  },
  {},
  1
);
assert.equal(metricGauge.ok, true);
assert.equal(metricGauge.unit, "length");
assertClose(metricGauge.unitPriceExVat, 12, "metric gauge plate complete 500mm length");

const imperialGauge = calculateMetalOrderItem(
  {
    id: "imperial-gauge",
    category: "gauge_plate",
    form: "Flat",
    metal: "Gauge Plate",
    spec: "Imperial",
    size: "1/4in",
    unit: 'Length (9")',
    stockSize: '18" x 3',
    priceExVat: 6.45,
  },
  {},
  1
);
assert.equal(imperialGauge.ok, true);
assertClose(imperialGauge.unitPriceExVat, 12.9, "imperial gauge plate complete 18in length");

const silverSteel = calculateMetalOrderItem(
  {
    id: "silver-steel",
    category: "silver_steel",
    form: "Round",
    metal: "Silver Steel",
    spec: "",
    size: "3/16in dia",
    unit: 'length / 13"',
    stockSize: '13" x 150',
    priceExVat: 2.5,
  },
  {},
  1
);
assert.equal(silverSteel.ok, true);
assertClose(silverSteel.unitPriceExVat, 2.5, "silver steel complete 13in length");
assert.equal(silverSteel.metalDimensions.display, 'Sold as pre-cut 13" Lengths');

const missingStockSize = getMetalOrderConfig({
  id: "missing-stock-size",
  category: "nickel_silver",
  form: "Flat",
  metal: "Nickel Silver",
  size: '1/16" x 1/4"',
  unit: "foot/300mm",
  stockSize: "",
  priceExVat: 3.5,
});
assert.equal(missingStockSize.mode, "length");
assert.equal(missingStockSize.maxLengthMm, undefined);
const missingStockSizePrice = calculateMetalOrderItem(
  {
    id: "missing-stock-size",
    category: "nickel_silver",
    form: "Flat",
    metal: "Nickel Silver",
    size: '1/16" x 1/4"',
    unit: "foot/300mm",
    stockSize: "",
    priceExVat: 3.5,
  },
  { lengthMm: 600 },
  2
);
assert.equal(missingStockSizePrice.ok, true);
assertClose(missingStockSizePrice.unitPriceExVat, 7, "missing stock-size profile still prices from 300mm rate");
assertClose(moneyLineTotal(missingStockSizePrice.unitPriceExVat, 2), 14, "missing stock-size profile total");

const reversedStockLength = getMetalOrderConfig({
  id: "reversed-stock-length",
  category: "aluminium",
  form: "Flat",
  metal: "Aluminium",
  size: '1/2" x 1 1/2"',
  unit: "foot/300mm",
  stockSize: "5 x 5M",
  priceExVat: 6.4,
});
assert.equal(reversedStockLength.mode, "length");
assertClose(reversedStockLength.maxLengthMm, 5000, "reversed stock quantity and max length still enforces 5m");
const overReversedStockLength = calculateMetalOrderItem(
  {
    id: "reversed-stock-length",
    category: "aluminium",
    form: "Flat",
    metal: "Aluminium",
    size: '1/2" x 1 1/2"',
    unit: "foot/300mm",
    stockSize: "5 x 5M",
    priceExVat: 6.4,
  },
  { lengthMm: 5100 },
  1
);
assert.equal(overReversedStockLength.ok, false);
assert.match(overReversedStockLength.error, /Maximum single length/);

const unknownStockLength = getMetalOrderConfig({
  id: "unknown-stock-length",
  category: "brass",
  form: "Boiler Band",
  metal: "Brass",
  size: '1/8" x 22swg',
  unit: "foot/300mm",
  stockSize: "5.6Kgs",
  priceExVat: 1.75,
});
assert.equal(unknownStockLength.mode, "length");
assert.equal(unknownStockLength.maxLengthMm, undefined);
const unknownStockPrice = calculateMetalOrderItem(
  {
    id: "unknown-stock-length",
    category: "brass",
    form: "Boiler Band",
    metal: "Brass",
    size: '1/8" x 22swg',
    unit: "foot/300mm",
    stockSize: "5.6Kgs",
    priceExVat: 1.75,
  },
  { lengthMm: 600 },
  1
);
assert.equal(unknownStockPrice.ok, true);
assertClose(unknownStockPrice.unitPriceExVat, 3.5, "unknown stock-size profile still calculates without max enforcement");

const packOfFive = {
  id: "pack-of-five",
  category: "brass",
  form: "Diameter",
  metal: "Brass",
  size: '0.020" D',
  unit: "Pack of 5",
  stockSize: "",
  priceExVat: 2.665,
};
assert.equal(getMetalOrderConfig(packOfFive).mode, "catalogue");
assert.equal(metalOrderNeedsDimensions(packOfFive), false);

const perTenFootWire = calculateMetalOrderItem(
  {
    id: "per-ten-foot-wire",
    category: "phosphor_bronze",
    form: "Wire - coiled",
    metal: "Phosphor Bronze",
    size: "2mm",
    unit: "per 10ft",
    stockSize: "170M",
    priceExVat: 15.5,
  },
  { inputUnit: "imperial", inputLength: 5 * 12 },
  1
);
assert.equal(perTenFootWire.ok, true);
assertClose(perTenFootWire.unitPriceExVat, 7.75, "per 10ft wire prices proportionally by length");

const poaProfile = calculateMetalOrderItem(
  {
    id: "poa-profile",
    category: "aluminium",
    form: "Flat",
    metal: "Aluminium",
    size: '1/2" x 1/8"',
    unit: "foot/300mm",
    stockSize: "",
    priceExVat: null,
  },
  { inputUnit: "imperial", inputLength: 24 },
  3
);
assert.equal(poaProfile.ok, true);
assert.equal(poaProfile.unitPriceExVat, null);
assert.equal(poaProfile.unitPriceIncVat, null);
assert.equal(poaProfile.metalDimensions.display, "Length 24 in");

const poaSheet = calculateMetalOrderItem(
  {
    id: "poa-sheet",
    category: "steel",
    form: "Sheet",
    metal: "Mild Steel",
    size: "5mm",
    unit: "",
    stockSize: "",
    priceExVat: null,
  },
  { lengthMm: 500, widthMm: 250 },
  1
);
assert.equal(poaSheet.ok, true);
assert.equal(poaSheet.unitPriceExVat, null);
assert.equal(poaSheet.metalDimensions.display, "500 mm x 250 mm");

console.log("Metal pricing tests passed");
