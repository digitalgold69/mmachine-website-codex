import { PDFDocument } from "pdf-lib";
import { miniCatalogueUrl } from "@/lib/catalogue-versions";
import {
  getMiniSectionForPdf,
  miniSectionPdfFilename,
  miniSectionPdfPageIndexes,
} from "@/lib/mini-section-pdfs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ sectionCode: string }> }
) {
  const params = await context.params;
  const sectionCode = decodeURIComponent(params.sectionCode || "");
  const section = getMiniSectionForPdf(sectionCode);
  const pageIndexes = miniSectionPdfPageIndexes(sectionCode);

  if (!section || !pageIndexes?.length) {
    return new Response("Section not found", { status: 404 });
  }

  const sourceUrl = new URL(miniCatalogueUrl, req.url);
  const sourceResponse = await fetch(sourceUrl, { cache: "no-store" });
  if (!sourceResponse.ok) {
    return new Response("Catalogue PDF could not be loaded", { status: 502 });
  }

  try {
    const sourcePdf = await PDFDocument.load(await sourceResponse.arrayBuffer(), {
      updateMetadata: false,
    });
    if (pageIndexes.some((pageIndex) => pageIndex >= sourcePdf.getPageCount())) {
      return new Response("Section pages were not found in the catalogue PDF", { status: 500 });
    }

    const sectionPdf = await PDFDocument.create();
    const pages = await sectionPdf.copyPages(sourcePdf, pageIndexes);
    pages.forEach((page) => sectionPdf.addPage(page));

    const pdfBytes = await sectionPdf.save();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(pdfBytes);
        controller.close();
      },
    });

    return new Response(body, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Disposition": `attachment; filename="${miniSectionPdfFilename(section)}"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Section PDF could not be created", { status: 500 });
  }
}
