import { getCatalogueOverrideMeta, getCatalogueOverridePdfObject } from "@/lib/catalogue-overrides";
import { STATIC_METALS_CATALOGUE_ASSET, staticCatalogueAssetResponse } from "@/lib/catalogue-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = await getCatalogueOverrideMeta("metals");
  if (meta?.pdfKey) {
    if (!meta.pdfKey?.endsWith("/catalogue-original.pdf")) {
      console.error("catalogue_pdf_not_canonical", {
        catalogue: "metals",
        pdfKey: meta.pdfKey,
        version: meta.version,
      });
      return new Response("The latest uploaded metals catalogue PDF is not in the canonical customer format. Please upload the catalogue again.", {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const uploaded = await getCatalogueOverridePdfObject("metals");
    if (!uploaded?.object.body) {
      console.error("catalogue_pdf_missing", {
        catalogue: "metals",
        pdfKey: meta.pdfKey,
        version: meta.version,
      });
      return new Response("The latest uploaded metals catalogue PDF could not be loaded. Please upload the catalogue again.", {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const headers = new Headers();
    if (uploaded.object.writeHttpMetadata) uploaded.object.writeHttpMetadata(headers);
    headers.set("Content-Type", uploaded.object.httpMetadata?.contentType || "application/pdf");
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", 'inline; filename="m-machine-metals-catalogue.pdf"');
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(uploaded.object.body, { headers });
  }

  return staticCatalogueAssetResponse(request, STATIC_METALS_CATALOGUE_ASSET);
}
