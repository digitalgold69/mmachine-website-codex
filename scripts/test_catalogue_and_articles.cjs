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
  assert.match(miniPage, /sm:hidden[\s\S]*Download \{currentSection\.code\} Section PDF/, "Mobile section PDF links should stack beside the section number");
  assert.match(miniPage, /hidden font-semibold[\s\S]*sm:inline[\s\S]*Download \{currentSection\.code\} Section PDF/, "Desktop section PDF links should stay inline with the description");
  assert.doesNotMatch(miniPage, /More filters/, "Mini catalogue filters must be visible without a More filters toggle");
  assert.doesNotMatch(miniPage, /Mark \/ year/, "Mini catalogue year filter should not use the old mark label");
  assert.match(miniPage, /YEAR_OPTIONS = Array\.from\(\{ length: 42 \}/, "Mini catalogue year dropdown must cover 1959-2000");
  assert.match(miniPage, /markDigitFromCode/, "Mini catalogue year filtering must use the part number digit rule");
  assert.match(miniPage, /HYDROLASTIC_DIGITS/, "Mini catalogue must support Hydrolastic-only filtering");
  assert.match(miniPage, /\/api\/mini-product-images/, "Mini catalogue must load uploaded product photos");
  assert.match(miniPage, /setPreviewImage/, "Mini catalogue product photos must open in a preview modal");
  assert.doesNotMatch(miniPage, /border-dashed border-racing\/10 bg-cream-dark\/50/, "Mini catalogue must not show empty thumbnail boxes when no product image exists");
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
