const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { PDFDocument } = require("pdf-lib");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const jiti = require("jiti")(__filename, {
  alias: {
    "@": root,
  },
  cache: false,
});

const {
  miniSectionPdfFilename,
  miniSectionPdfPageIndexes,
} = jiti("../lib/mini-section-pdfs.ts");
const { guides } = jiti("../lib/articles.ts");
const { parseUploadedCatalogue } = jiti("../lib/catalogue-upload-parser.ts");
const {
  catalogueMoney,
  normaliseCatalogueProductPrices,
} = jiti("../lib/catalogue-pricing.ts");

function workbookBytes(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

async function main() {
  const pdfBytes = fs.readFileSync(path.join(root, "public/catalogue/mini-catalogue.pdf"));
  const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  assert.equal(pdf.getPageCount(), 42, "Mini catalogue PDF page count should match the section page map");
  assert.deepEqual(miniSectionPdfPageIndexes("120"), [3, 4], "120 should extract the first two section pages");
  assert.deepEqual(miniSectionPdfPageIndexes("150"), [9, 10], "150 should extract its drawing and parts-list pages");
  assert.deepEqual(miniSectionPdfPageIndexes("510"), [37, 38], "510 should extract its drawing and parts-list pages");
  assert.deepEqual(miniSectionPdfPageIndexes("Apx1"), [39], "Apx1 should extract its appendix page");
  assert.deepEqual(miniSectionPdfPageIndexes("Apx2"), [40], "Apx2 should extract its appendix page");
  assert.equal(
    miniSectionPdfFilename({ code: "150", label: "DOORS", subtitle: "", order: 4, mode: "exterior" }),
    "m-machine-mini-section-150-doors.pdf"
  );

  const miniPage = read("app/(site)/catalogue/mini/page.tsx");
  assert.match(miniPage, /sectionSummaryRef/, "Mini category selection must scroll to the section summary");
  assert.match(miniPage, /Download \{currentSection\.code\} Section PDF/, "Mini section summary must link to section PDF downloads");
  assert.match(miniPage, /Download Full PDF Catalogue/, "Mini section summary must link to the full PDF");
  assert.match(miniPage, /miniCatalogueVersion/, "Section download links must be cache-busted with the latest catalogue version");
  assert.match(miniPage, /view=1/, "Section PDF links must avoid older cached attachment responses");
  assert.doesNotMatch(miniPage, /href=\{`\/api\/catalogue\/mini-sections[\s\S]*?download/, "Mini section PDFs should open in a browser tab instead of auto-downloading");
  assert.match(miniPage, /target="_blank"[\s\S]*Download \{currentSection\.code\} Section PDF/, "Mini section PDF links should open in a new tab");
  assert.match(miniPage, /sm:hidden[\s\S]*Download \{currentSection\.code\} Section PDF/, "Mobile section PDF links should stack beside the section number");
  assert.match(miniPage, /hidden font-semibold[\s\S]*sm:inline[\s\S]*Download \{currentSection\.code\} Section PDF/, "Desktop section PDF links should stay inline with the description");
  assert.doesNotMatch(miniPage, /More filters/, "Mini catalogue should not use the old More filters toggle");
  assert.doesNotMatch(miniPage, /Mark \/ year|YEAR_OPTIONS|markDigitFromCode|HYDROLASTIC_DIGITS|mini-panel-body|mini-panel-year/, "Mini catalogue should not hide parts behind year, body type or Hydrolastic filters");
  assert.match(miniPage, /\/api\/mini-product-images/, "Mini catalogue must load uploaded product photos");
  assert.match(miniPage, /\/api\/products\?catalogue=mini&limit=1200/, "Mini catalogue must load dashboard-added manual Mini parts");
  assert.match(miniPage, /manualMiniSection/, "Mini catalogue must expose the manual Other section when manual parts exist");
  assert.match(miniPage, /setPreviewImage/, "Mini catalogue product photos must open in a preview modal");
  assert.match(miniPage, /function NoImageIcon/, "Mini catalogue should show a compact No Image Yet marker in empty desktop photo cells");
  assert.match(miniPage, /title="No image yet"/, "Mini catalogue no-image marker should explain the empty photo state");
  assert.match(miniPage, /<col className="w-\[58px\]" \/>/, "Mini catalogue desktop photo column should stay compact between code and description");
  assert.match(miniPage, /xl:pl-20/, "Mini catalogue desktop descriptions should sit closer to the photo column without losing the column spacing");
  assert.match(miniPage, /text-center">[\s\S]*Photo/, "Mini catalogue desktop photo column should be centred");
  assert.match(miniPage, /translate-x-5[\s\S]*Photo/, "Mini catalogue desktop photo heading should be nudged toward the description column");
  assert.match(miniPage, /h-11 w-11 translate-x-5/, "Mini catalogue desktop thumbnails should sit closer to the description column");
  assert.match(miniPage, /previewImage\.alt[\s\S]*previewImage\.code/, "Mini catalogue image preview should label the description and part number");
  assert.match(miniPage, /bg-racing[\s\S]*previewImage\.alt/, "Mini catalogue preview description label should use the primary pill style");
  assert.match(miniPage, /bg-cream[\s\S]*previewImage\.code/, "Mini catalogue preview part number should use a secondary pill style");
  assert.match(miniPage, /Inc VAT:[\s\S]*<strong className="text-racing">\{money\(p\.priceIncVat\)\}<\/strong>/, "Mobile mini cards must keep inc VAT beside the part number");

  const navbar = read("components/Navbar.tsx");
  assert.match(navbar, /Custom Engineering Work/, "Header navigation should use the fuller custom engineering wording where space allows");
  assert.match(navbar, /Custom Engineering/, "Header navigation should keep a shorter desktop custom engineering label available");

  const productsRoute = read("app/api/products/route.ts");
  assert.match(productsRoute, /getLiveMiniCatalogueProducts\(\{ includeManual: true \}\)/, "Products API must merge active manual Mini parts through the live Mini catalogue helper");
  assert.match(productsRoute, /getLiveMetalCatalogueProducts/, "Products API must read dashboard-uploaded metals before generated fallback data");
  assert.match(productsRoute, /catalogue === "mini" \? 1200 : 5000/, "Products API must allow the full Mini and metals catalogues to be fetched by the dashboard");

  const quoteRoute = read("app/api/quote-requests/route.ts");
  assert.match(quoteRoute, /getLiveMiniCatalogueProducts\(\{ includeManual: true \}\)/, "Quote requests must validate uploaded and dashboard-added Mini parts");
  assert.match(quoteRoute, /getLiveMetalCatalogueProducts/, "Quote requests must validate uploaded metals catalogue lines");

  const dashboardProductsPage = read("app/dashboard/(protected)/products/page.tsx");
  assert.match(dashboardProductsPage, /Manually added/, "Dashboard products tab must include manual Mini part management");
  assert.match(dashboardProductsPage, /\/api\/manual-mini-products/, "Manual Mini products must be loaded and saved through their own API");
  assert.match(dashboardProductsPage, /NoImageIcon/, "Dashboard Mini product rows should show the no-image icon where no photo exists");
  assert.match(dashboardProductsPage, /Update catalogues/, "Dashboard products tab must include catalogue workbook upload controls");
  assert.match(dashboardProductsPage, /Upload &amp; save/, "Catalogue upload button must use the requested label");
  assert.match(dashboardProductsPage, /\/api\/catalogue-uploads/, "Dashboard uploads must save via the catalogue upload API");

  const manualProductsLib = read("lib/manual-mini-products.ts");
  assert.match(manualProductsLib, /create table if not exists manual_mini_products/, "Manual Mini products must be stored outside generated catalogue files");
  assert.match(manualProductsLib, /on conflict\(id\) do update/, "Manual Mini products must support dashboard edits without duplicate rows");

  const sectionPdfRoute = read("app/api/catalogue/mini-sections/[sectionCode]/pdf/route.ts");
  assert.match(sectionPdfRoute, /ASSETS\.fetch/, "Deployed section PDFs must read the catalogue through the Cloudflare assets binding");
  assert.match(sectionPdfRoute, /getCatalogueOverrideProducts/, "Section PDF downloads must use uploaded Mini catalogue rows when available");
  assert.match(sectionPdfRoute, /staticCatalogueAssetResponse/, "Local section PDF generation must keep a static asset fallback");
  assert.match(sectionPdfRoute, /"Content-Disposition": `inline;/, "Section PDFs should render in-browser by default");
  assert.match(sectionPdfRoute, /"Cache-Control": "no-store"/, "Section PDFs should not keep stale download headers cached");

  const uploadRoute = read("app/api/catalogue-uploads/route.ts");
  assert.match(uploadRoute, /parseUploadedCatalogue/, "Catalogue upload API must parse Excel workbooks server-side");
  assert.match(uploadRoute, /saveCatalogueOverride/, "Catalogue upload API must save live override data");
  assert.match(uploadRoute, /buildMiniCataloguePdfBytes/, "Mini workbook uploads must regenerate the live Mini PDF");
  assert.match(uploadRoute, /buildMetalsCataloguePdfBytes/, "Metals workbook uploads must regenerate the live Metals PDF");

  const ordersClient = read("app/dashboard/(protected)/orders/OrdersClient.tsx");
  assert.match(ordersClient, /PaymentSettingsModal/, "Dashboard must expose editable payment method settings");
  assert.match(ordersClient, /max-h-\[calc\(100vh-2rem\)\]/, "Payment method settings modal must fit short laptop screens");
  assert.match(ordersClient, /min-h-0 flex-1 overflow-y-auto px-4 pb-4/, "Payment method settings modal fields must scroll inside the dialog");

  const overridesLib = read("lib/catalogue-overrides.ts");
  assert.match(overridesLib, /catalogue_overrides/, "Uploaded catalogue metadata must be stored separately from manual Mini products");
  assert.match(overridesLib, /catalogue-overrides\/\$\{input\.catalogue\}/, "Uploaded workbooks, products and PDFs must be stored in a catalogue override R2 path");

  assert.equal(catalogueMoney(0), "POA", "Catalogue prices entered as zero must display as POA");
  assert.equal(catalogueMoney(0.17), "\u00a30.17", "Sub-pound catalogue prices must remain valid");
  const normalisedZero = normaliseCatalogueProductPrices([{ priceExVat: 0, priceIncVat: 0 }])[0];
  assert.equal(normalisedZero.priceExVat, null, "Generated or stored zero ex VAT prices must normalise to POA");
  assert.equal(normalisedZero.priceIncVat, null, "Generated or stored zero inc VAT prices must normalise to POA");

  const zeroMiniUpload = parseUploadedCatalogue(
    "mini",
    workbookBytes({
      "999B": [
        ["Code", "Description", "Ex VAT", "Inc VAT"],
        ["11.99.00.00", "Zero Price Test Panel", 0, 0],
      ],
    })
  );
  assert.equal(zeroMiniUpload.products[0].priceExVat, null, "Uploaded Mini lines priced at zero must become POA");
  assert.equal(zeroMiniUpload.products[0].priceIncVat, null, "Uploaded Mini inc VAT zero prices must become POA");

  const zeroMetalsUpload = parseUploadedCatalogue(
    "metals",
    workbookBytes({
      Steel: [
        ["Shape", "Metal", "Spec", "Size", "Ex VAT", "Unit", "", "Code"],
        ["Flat", "Steel", "EN3B", "10mm x 20mm", 0, "foot/300mm", "", "ZERO-METAL"],
      ],
    })
  );
  assert.equal(zeroMetalsUpload.products[0].priceExVat, null, "Uploaded metals lines priced at zero must become POA");
  assert.equal(zeroMetalsUpload.products[0].priceIncVat, null, "Uploaded metals inc VAT zero prices must become POA");

  const miniUploadSource = fs.existsSync(path.join(root, "final-deliverables/Mini Catalogue Self Updating.xlsm"))
    ? "final-deliverables/Mini Catalogue Self Updating.xlsm"
    : "data-source/Mini Catalogue Self Updating.xlsm";
  const miniUpload = parseUploadedCatalogue(
    "mini",
    new Uint8Array(fs.readFileSync(path.join(root, miniUploadSource)))
  );
  assert.ok(miniUpload.products.length >= 700, "Mini workbook uploads should parse the full catalogue");
  assert.equal(miniUpload.products[0].id, "p0001", "Known Mini rows should keep generated ids so product photos remain attached");

  const metalsUploadSource = fs.existsSync(path.join(root, "final-deliverables/Metals catalogue 2023.xlsx"))
    ? "final-deliverables/Metals catalogue 2023.xlsx"
    : "data-source/Metals catalogue 2023.xlsx";
  const metalsUpload = parseUploadedCatalogue(
    "metals",
    new Uint8Array(fs.readFileSync(path.join(root, metalsUploadSource)))
  );
  assert.ok(metalsUpload.products.length >= 1000, "Metals workbook uploads should parse the full catalogue");
  assert.ok(metalsUpload.products.some((product) => product.form && product.size && product.unit), "Uploaded metals rows must keep shape, size and unit fields for dimension pricing");

  const guideDates = guides.map((guide) => Date.parse(guide.publishedAt));
  assert.deepEqual(
    guideDates,
    [...guideDates].sort((a, b) => b - a),
    "Engineering guides must always be sorted newest first"
  );
  assert.equal(guides[0].id, "reverse-engineering-worn-parts", "Newest workshop article should be first");
  assert.equal(guides[1].id, "custom-engineering-guide", "Custom engineering guide should be second newest");

  console.log("ok - mini catalogue downloads and engineering guide ordering are wired");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
