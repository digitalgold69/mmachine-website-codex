import { requireLogin } from "@/lib/auth";
import { getCatalogueOverrideSourceObject } from "@/lib/catalogue-overrides";
import type { CatalogueUploadKind } from "@/lib/catalogue-upload-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDownloadName(name: string) {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .trim() || "catalogue.xlsx";
}

function safeCatalogue(value: string | undefined): CatalogueUploadKind | null {
  return value === "mini" || value === "metals" ? value : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ catalogue: string }> }
) {
  const auth = await requireLogin();
  if (auth) return auth;

  const params = await context.params;
  const catalogue = safeCatalogue(params.catalogue);
  if (!catalogue) return new Response("Not found", { status: 404 });

  const source = await getCatalogueOverrideSourceObject(catalogue).catch(() => null);
  if (!source?.object.body) return new Response("No uploaded catalogue workbook found", { status: 404 });

  const headers = new Headers();
  if (source.object.writeHttpMetadata) source.object.writeHttpMetadata(headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", source.object.httpMetadata?.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  headers.set("Content-Disposition", `attachment; filename="${safeDownloadName(source.meta.sourceFilename).replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(source.object.body, { headers });
}
