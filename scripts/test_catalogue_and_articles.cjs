const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

  const sectionPdfRoute = read("app/api/catalogue/mini-sections/[sectionCode]/pdf/route.ts");
  assert.match(sectionPdfRoute, /ASSETS\.fetch/, "Deployed section PDFs must read the catalogue through the Cloudflare assets binding");
  assert.match(sectionPdfRoute, /fetch\(sourceUrl,\s*\{\s*cache:\s*"no-store"\s*\}\)/, "Local section PDF generation must keep a direct-fetch fallback");
  assert.match(sectionPdfRoute, /"Content-Disposition": `inline;/, "Section PDFs should render in-browser by default");
  assert.match(sectionPdfRoute, /"Cache-Control": "no-store"/, "Section PDFs should not keep stale download headers cached");

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
