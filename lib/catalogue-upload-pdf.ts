import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { sections } from "@/lib/mini-data";
import { miniSectionPdfPageIndexes } from "@/lib/mini-section-pdfs";

export async function validateCatalogueUploadPdf(bytes: Uint8Array, catalogue: "mini" | "metals") {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() < 1) throw new Error("The PDF has no pages.");
  if (catalogue !== "mini") return;
  if (document.getPageCount() !== 42) {
    throw new Error("The Mini PDF must keep the existing 42-page layout, including the drawings and cover pages. Nothing has been updated.");
  }
  for (const section of sections.filter((item) => /^\d+$/.test(item.code))) {
    const index = miniSectionPdfPageIndexes(section.code)![0];
    const page = document.getPage(index);
    const images = page.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!images?.keys().length) {
      throw new Error(`The drawing page for Mini section ${section.code} is missing. Export the complete catalogue PDF in its existing page order. Nothing has been updated.`);
    }
  }
}
