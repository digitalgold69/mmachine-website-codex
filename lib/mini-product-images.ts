import { products } from "@/lib/mini-data";
import { getD1, getFeaturedImagesBucket, type R2BucketBinding } from "@/lib/cloudflare";
import { getManualMiniProduct } from "@/lib/manual-mini-products";

export type MiniProductImage = {
  productId: string;
  url: string;
  uploadedAt: string;
};

type MiniProductImageRow = {
  product_id: string;
  image_key: string;
  content_type: string;
  uploaded_at: string;
};

let schemaReady: Promise<void> | null = null;

async function ensureMiniProductImagesSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getD1();
      const result = await db.prepare(`
        create table if not exists mini_product_images (
          product_id text primary key,
          image_key text not null,
          content_type text not null,
          uploaded_at text not null
        )
      `).run();
      if (result.error) throw new Error(`D1 mini product image setup failed: ${result.error}`);
    })();
  }

  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

function imageUrl(row: MiniProductImageRow) {
  return `/api/mini-product-images/${encodeURIComponent(row.product_id)}?v=${encodeURIComponent(row.uploaded_at)}`;
}

function rowToImage(row: MiniProductImageRow): MiniProductImage {
  return {
    productId: row.product_id,
    url: imageUrl(row),
    uploadedAt: row.uploaded_at,
  };
}

function safeProductId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

async function validateProductId(productId: string) {
  const safe = safeProductId(productId);
  if (
    !safe ||
    (
      !products.some((product) => product.id === safe) &&
      !(await getManualMiniProduct(safe))
    )
  ) {
    throw new Error("Mini panel part not found.");
  }
  return safe;
}

function extFromDataUrl(url: string): "jpg" | "png" | "webp" | null {
  const match = url.match(/^data:image\/(jpe?g|png|webp);base64,/i);
  if (!match) return null;
  const subtype = match[1].toLowerCase();
  return subtype === "jpeg" ? "jpg" : subtype as "jpg" | "png" | "webp";
}

function contentTypeFromExt(ext: "jpg" | "png" | "webp") {
  return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
}

function bytesFromDataUrl(url: string): Uint8Array {
  const idx = url.indexOf("base64,");
  if (idx < 0) throw new Error("Image is not a base64 data URL.");
  return new Uint8Array(Buffer.from(url.slice(idx + "base64,".length), "base64"));
}

export async function listMiniProductImages(): Promise<MiniProductImage[]> {
  await ensureMiniProductImagesSchema();
  const db = await getD1();
  const result = await db
    .prepare("select product_id, image_key, content_type, uploaded_at from mini_product_images order by product_id")
    .all<MiniProductImageRow>();

  if (result.error) throw new Error(`D1 mini product image read failed: ${result.error}`);
  return (result.results || []).map(rowToImage);
}

export async function getMiniProductImageObject(productId: string): Promise<{
  object: Awaited<ReturnType<R2BucketBinding["get"]>>;
  contentType: string;
} | null> {
  const safe = safeProductId(productId);
  if (!safe) return null;

  await ensureMiniProductImagesSchema();
  const db = await getD1();
  const row = await db
    .prepare("select product_id, image_key, content_type, uploaded_at from mini_product_images where product_id = ?")
    .bind(safe)
    .first<MiniProductImageRow>();

  if (!row) return null;
  const bucket = await getFeaturedImagesBucket();
  const object = await bucket.get(row.image_key);
  if (!object?.body) return null;
  return { object, contentType: row.content_type };
}

export async function saveMiniProductImage(input: {
  productId: string;
  imageDataUrl: string;
}): Promise<MiniProductImage> {
  const productId = await validateProductId(input.productId);
  const ext = extFromDataUrl(input.imageDataUrl);
  if (!ext) throw new Error("Image must be JPG, PNG, or WebP.");

  const bytes = bytesFromDataUrl(input.imageDataUrl);
  if (bytes.byteLength > 2.5 * 1024 * 1024) {
    throw new Error("Image is too large after optimisation. Please use a smaller photo.");
  }

  await ensureMiniProductImagesSchema();
  const db = await getD1();
  const current = await db
    .prepare("select product_id, image_key, content_type, uploaded_at from mini_product_images where product_id = ?")
    .bind(productId)
    .first<MiniProductImageRow>();

  const bucket = await getFeaturedImagesBucket();
  const uploadedAt = new Date().toISOString();
  const contentType = contentTypeFromExt(ext);
  const imageKey = `mini-product-images/${productId}-${Date.now()}.${ext}`;

  await bucket.put(imageKey, bytes, {
    httpMetadata: { contentType },
  });

  const result = await db
    .prepare(`
      insert into mini_product_images (product_id, image_key, content_type, uploaded_at)
      values (?, ?, ?, ?)
      on conflict(product_id) do update set
        image_key = excluded.image_key,
        content_type = excluded.content_type,
        uploaded_at = excluded.uploaded_at
    `)
    .bind(productId, imageKey, contentType, uploadedAt)
    .run();

  if (result.error) {
    try {
      await bucket.delete(imageKey);
    } catch {
      // The D1 error is the useful failure to return to the dashboard.
    }
    throw new Error(`D1 mini product image save failed: ${result.error}`);
  }

  if (current?.image_key && current.image_key !== imageKey) {
    try {
      await bucket.delete(current.image_key);
    } catch {
      // The new image is already live; stale cleanup can wait.
    }
  }

  return rowToImage({
    product_id: productId,
    image_key: imageKey,
    content_type: contentType,
    uploaded_at: uploadedAt,
  });
}

export async function deleteMiniProductImage(productId: string): Promise<void> {
  const safe = await validateProductId(productId);
  await ensureMiniProductImagesSchema();
  const db = await getD1();
  const current = await db
    .prepare("select product_id, image_key, content_type, uploaded_at from mini_product_images where product_id = ?")
    .bind(safe)
    .first<MiniProductImageRow>();

  const result = await db.prepare("delete from mini_product_images where product_id = ?").bind(safe).run();
  if (result.error) throw new Error(`D1 mini product image delete failed: ${result.error}`);

  if (current?.image_key) {
    try {
      const bucket = await getFeaturedImagesBucket();
      await bucket.delete(current.image_key);
    } catch {
      // The row is gone; a stale object should not fail the request.
    }
  }
}
