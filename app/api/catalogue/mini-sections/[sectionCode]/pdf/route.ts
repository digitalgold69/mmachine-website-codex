import { MINI_PAGE_MAP_PREFIX } from "@/lib/mini-workbook-pdf";
import { PDFDocument } from "pdf-lib";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { miniCatalogueUrl } from "@/lib/catalogue-versions";
import {
  getMiniSectionForPdf,
  miniSectionPdfFilename,
  miniSectionPdfPageIndexes,
} from "@/lib/mini-section-pdfs";
import { getCatalogueOverridePdfObject } from "@/lib/catalogue-overrides";
import { staticCatalogueAssetResponse } from "@/lib/catalogue-pdf";

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

  const uploaded = await getCatalogueOverridePdfObject("mini");
  const sourceUrl = new URL(miniCatalogueUrl, req.url);
  const env = await getCloudflareEnv().catch(() => null);
  const sourceResponse = uploaded?.meta.pdfKey?.endsWith("/catalogue-original.pdf") && uploaded.object.body
    ? new Response(uploaded.object.body)
    : env?.ASSETS
    ? await env.ASSETS.fetch(new Request(sourceUrl))
    : await staticCatalogueAssetResponse(req, "/catalogue/mini-catalogue.pdf");
  if (!sourceResponse.ok) {
    return new Response("Catalogue PDF could not be loaded", { status: 502 });
  }

  try {
    const sourcePdf = await PDFDocument.load(await sourceResponse.arrayBuffer(), {
      updateMetadata: false,
    });
    const subject = sourcePdf.getSubject() || "";
    const mappedPages = subject.startsWith(MINI_PAGE_MAP_PREFIX) ? JSON.parse(subject.slice(MINI_PAGE_MAP_PREFIX.length))[section.code] as number[] : pageIndexes;
    if (!Array.isArray(mappedPages) || !mappedPages.length) throw new Error("Missing section page map");
    if (mappedPages.some((pageIndex) => pageIndex >= sourcePdf.getPageCount())) {
      return new Response("Section pages were not found in the catalogue PDF", { status: 500 });
    }

    const sectionPdf = await PDFDocument.create();
    const pages = await sectionPdf.copyPages(sourcePdf, mappedPages);
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
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${miniSectionPdfFilename(section)}"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Section PDF could not be created", { status: 500 });
  }
}
