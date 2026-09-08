import { NextResponse } from "next/server";
import { getCurrentUser, requireLogin } from "@/lib/auth";
import { listCatalogueOverrideMetas, saveCatalogueOverride } from "@/lib/catalogue-overrides";
import { parseUploadedCatalogue, type CatalogueUploadKind } from "@/lib/catalogue-upload-parser";
import { buildMetalsCataloguePdfBytes, buildMiniCataloguePdfBytes } from "@/lib/catalogue-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WORKBOOK_SIZE = 24 * 1024 * 1024;

function safeCatalogue(value: FormDataEntryValue | null): CatalogueUploadKind | null {
  return value === "mini" || value === "metals" ? value : null;
}

function workbookAllowed(file: File) {
  return /\.(xlsx|xlsm|xls)$/i.test(file.name);
}

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const uploads = await listCatalogueOverrideMetas();
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Catalogue upload status could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const form = await request.formData();
    const catalogue = safeCatalogue(form.get("catalogue"));
    const file = form.get("file");

    if (!catalogue) {
      return NextResponse.json({ error: "Choose Mini panels or Metals before uploading." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Choose an Excel catalogue file first." }, { status: 400 });
    }
    if (file.size > MAX_WORKBOOK_SIZE) {
      return NextResponse.json({ error: "Upload a catalogue workbook under 24 MB." }, { status: 400 });
    }
    if (!workbookAllowed(file)) {
      return NextResponse.json({ error: "Upload an .xlsx, .xlsm or .xls workbook." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseUploadedCatalogue(catalogue, bytes);
    const user = await getCurrentUser();
    const upload = parsed.catalogue === "mini"
      ? await saveCatalogueOverride({
          catalogue: "mini",
          products: parsed.products,
          pdfBytes: await buildMiniCataloguePdfBytes(parsed.products),
          sourceBytes: bytes,
          sourceFilename: file.name,
          sourceContentType: file.type || undefined,
          uploadedBy: user?.email || null,
        })
      : await saveCatalogueOverride({
          catalogue: "metals",
          products: parsed.products,
          pdfBytes: await buildMetalsCataloguePdfBytes(parsed.products),
          sourceBytes: bytes,
          sourceFilename: file.name,
          sourceContentType: file.type || undefined,
          uploadedBy: user?.email || null,
        });

    return NextResponse.json({
      ok: true,
      upload,
      warnings: parsed.warnings,
    });
  } catch (error) {
    console.error("catalogue_upload_failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: (error as Error).message || "Catalogue upload could not be saved." },
      { status: 500 }
    );
  }
}
