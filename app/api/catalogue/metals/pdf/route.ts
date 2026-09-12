import { getCatalogueOverridePdfObject } from "@/lib/catalogue-overrides";
import { staticCatalogueAssetResponse } from "@/lib/catalogue-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const uploaded = await getCatalogueOverridePdfObject("metals").catch(() => null);
  if (uploaded?.object.body) {
    const headers = new Headers();
    if (uploaded.object.writeHttpMetadata) uploaded.object.writeHttpMetadata(headers);
    headers.set("Content-Type", uploaded.object.httpMetadata?.contentType || "application/pdf");
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", 'inline; filename="m-machine-metals-catalogue.pdf"');
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(uploaded.object.body, { headers });
  }

  return staticCatalogueAssetResponse(request, "/catalogue/metals-catalogue.pdf");
}
