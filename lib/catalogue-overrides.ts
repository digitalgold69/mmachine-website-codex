import { getD1, getFeaturedImagesBucket, type R2BucketBinding } from "@/lib/cloudflare";
import type { CatalogueUploadKind } from "@/lib/catalogue-upload-parser";

export type CatalogueOverrideMeta = {
  catalogue: CatalogueUploadKind;
  productsKey: string;
  pdfKey: string | null;
  sourceKey: string | null;
  sourceFilename: string;
  sourceSize: number;
  productCount: number;
  version: string;
  uploadedAt: string;
  uploadedBy: string | null;
};

type CatalogueOverrideRow = {
  catalogue: string;
  products_key: string;
  pdf_key: string | null;
  source_key: string | null;
  source_filename: string;
  source_size: number | string | null;
  product_count: number | string | null;
  version: string;
  uploaded_at: string;
  uploaded_by: string | null;
};

let schemaReady: Promise<void> | null = null;

async function ensureCatalogueOverrideSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getD1();
      const result = await db.prepare(`
        create table if not exists catalogue_overrides (
          catalogue text primary key check (catalogue in ('mini', 'metals')),
          products_key text not null,
          pdf_key text,
          source_key text,
          source_filename text not null,
          source_size integer not null default 0,
          product_count integer not null default 0,
          version text not null,
          uploaded_at text not null,
          uploaded_by text
        )
      `).run();
      if (result.error) throw new Error(`D1 catalogue override setup failed: ${result.error}`);
    })();
  }

  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

function rowToMeta(row: CatalogueOverrideRow): CatalogueOverrideMeta {
  return {
    catalogue: row.catalogue === "metals" ? "metals" : "mini",
    productsKey: row.products_key,
    pdfKey: row.pdf_key || null,
    sourceKey: row.source_key || null,
    sourceFilename: row.source_filename,
    sourceSize: Number(row.source_size || 0),
    productCount: Number(row.product_count || 0),
    version: row.version,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by || null,
  };
}

function safeFilename(name: string) {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "catalogue.xlsx";
}

function workbookContentType(filename: string, fallback?: string) {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  if (/\.xlsm$/i.test(filename)) return "application/vnd.ms-excel.sheet.macroEnabled.12";
  if (/\.xls$/i.test(filename)) return "application/vnd.ms-excel";
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function versionId() {
  return `${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

async function objectText(object: Awaited<ReturnType<R2BucketBinding["get"]>>) {
  if (!object?.body) return null;
  return new Response(object.body).text();
}

async function getBucket() {
  return getFeaturedImagesBucket();
}

export async function getCatalogueOverrideMeta(catalogue: CatalogueUploadKind) {
  await ensureCatalogueOverrideSchema();
  const db = await getD1();
  const row = await db
    .prepare(`
      select catalogue, products_key, pdf_key, source_key, source_filename, source_size,
             product_count, version, uploaded_at, uploaded_by
      from catalogue_overrides
      where catalogue = ?
      limit 1
    `)
    .bind(catalogue)
    .first<CatalogueOverrideRow>();

  return row ? rowToMeta(row) : null;
}

export async function listCatalogueOverrideMetas() {
  await ensureCatalogueOverrideSchema();
  const db = await getD1();
  const result = await db
    .prepare(`
      select catalogue, products_key, pdf_key, source_key, source_filename, source_size,
             product_count, version, uploaded_at, uploaded_by
      from catalogue_overrides
      order by catalogue
    `)
    .all<CatalogueOverrideRow>();

  if (result.error) throw new Error(`D1 catalogue override read failed: ${result.error}`);
  return (result.results || []).map(rowToMeta);
}

export async function getCatalogueOverrideProducts<T>(catalogue: CatalogueUploadKind) {
  const meta = await getCatalogueOverrideMeta(catalogue);
  if (!meta) return null;

  const bucket = await getBucket();
  const object = await bucket.get(meta.productsKey);
  const text = await objectText(object);
  if (!text) return null;

  const parsed = JSON.parse(text) as { products?: T[] };
  if (!Array.isArray(parsed.products)) return null;
  return {
    meta,
    products: parsed.products,
  };
}

export async function getCatalogueOverridePdfObject(catalogue: CatalogueUploadKind) {
  const meta = await getCatalogueOverrideMeta(catalogue);
  if (!meta?.pdfKey) return null;

  const bucket = await getBucket();
  const object = await bucket.get(meta.pdfKey);
  return object?.body ? { meta, object } : null;
}

export async function saveCatalogueOverride<T>(input: {
  catalogue: CatalogueUploadKind;
  products: T[];
  pdfBytes: Uint8Array;
  sourceBytes: Uint8Array;
  sourceFilename: string;
  sourceContentType?: string;
  uploadedBy?: string | null;
}) {
  await ensureCatalogueOverrideSchema();

  const safeName = safeFilename(input.sourceFilename);
  const version = versionId();
  const prefix = `catalogue-overrides/${input.catalogue}/${version}`;
  const productsKey = `${prefix}/products.json`;
  const pdfKey = `${prefix}/catalogue.pdf`;
  const sourceKey = `${prefix}/${safeName}`;
  const uploadedAt = new Date().toISOString();
  const productsBody = new TextEncoder().encode(JSON.stringify({
    catalogue: input.catalogue,
    version,
    sourceFilename: safeName,
    savedAt: uploadedAt,
    products: input.products,
  }));

  const db = await getD1();
  const previous = await getCatalogueOverrideMeta(input.catalogue).catch(() => null);
  const bucket = await getBucket();

  await bucket.put(productsKey, productsBody, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  await bucket.put(pdfKey, input.pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
  });
  await bucket.put(sourceKey, input.sourceBytes, {
    httpMetadata: { contentType: workbookContentType(safeName, input.sourceContentType) },
  });

  const result = await db.prepare(`
    insert into catalogue_overrides (
      catalogue, products_key, pdf_key, source_key, source_filename, source_size,
      product_count, version, uploaded_at, uploaded_by
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(catalogue) do update set
      products_key = excluded.products_key,
      pdf_key = excluded.pdf_key,
      source_key = excluded.source_key,
      source_filename = excluded.source_filename,
      source_size = excluded.source_size,
      product_count = excluded.product_count,
      version = excluded.version,
      uploaded_at = excluded.uploaded_at,
      uploaded_by = excluded.uploaded_by
  `)
    .bind(
      input.catalogue,
      productsKey,
      pdfKey,
      sourceKey,
      safeName,
      input.sourceBytes.byteLength,
      input.products.length,
      version,
      uploadedAt,
      input.uploadedBy || null
    )
    .run();

  if (result.error) {
    await Promise.allSettled([bucket.delete(productsKey), bucket.delete(pdfKey), bucket.delete(sourceKey)]);
    throw new Error(`D1 catalogue override save failed: ${result.error}`);
  }

  if (previous) {
    await Promise.allSettled(
      [previous.productsKey, previous.pdfKey, previous.sourceKey]
        .filter((key): key is string => Boolean(key))
        .filter((key) => ![productsKey, pdfKey, sourceKey].includes(key))
        .map((key) => bucket.delete(key))
    );
  }

  return {
    catalogue: input.catalogue,
    productsKey,
    pdfKey,
    sourceKey,
    sourceFilename: safeName,
    sourceSize: input.sourceBytes.byteLength,
    productCount: input.products.length,
    version,
    uploadedAt,
    uploadedBy: input.uploadedBy || null,
  } satisfies CatalogueOverrideMeta;
}
