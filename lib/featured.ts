import { getD1, getFeaturedImagesBucket } from "@/lib/cloudflare";

export type FeaturedWork = {
  id: string;
  title: string;
  description: string;
  tag: string;
  year: number;
  category: string;
  fullStory: string;
  imagePath: string | null;
  priceExVat: number | null;
  hideExVat: boolean;
};

export type FeaturedEntry = {
  id: string;
  title: string;
  description: string;
  tag: string;
  year: number;
  category: string;
  fullStory: string;
  image: string;
  priceExVat: number | null;
  hideExVat: boolean;
};

type FeaturedRow = {
  id: string;
  title: string;
  description: string | null;
  tag: string | null;
  year: number | null;
  category: string | null;
  full_story: string | null;
  image_url: string | null;
  image_path: string | null;
  created_at: string;
  price_ex_vat: number | null;
  hide_ex_vat: number | null;
};

let pricingSchemaReady: Promise<void> | null = null;

async function ensureFeaturedPricingSchema() {
  if (!pricingSchemaReady) {
    pricingSchemaReady = (async () => {
      const db = await getD1();
      const table = await db.prepare(`
        create table if not exists featured_work_prices (
          featured_id text primary key,
          price_ex_vat real check (price_ex_vat is null or price_ex_vat >= 0),
          hide_ex_vat integer not null default 0 check (hide_ex_vat in (0, 1)),
          updated_at text not null
        )
      `).run();
      if (table.error) throw new Error(`D1 featured pricing setup failed: ${table.error}`);

      const columns = await db.prepare("pragma table_info(featured_work_prices)").all<{ name: string }>();
      if (columns.error) throw new Error(`D1 featured pricing schema check failed: ${columns.error}`);
      const hasHideExVat = (columns.results || []).some((column) => column.name === "hide_ex_vat");
      if (!hasHideExVat) {
        const alter = await db
          .prepare("alter table featured_work_prices add column hide_ex_vat integer not null default 0")
          .run();
        if (alter.error && !String(alter.error).toLowerCase().includes("duplicate column")) {
          throw new Error(`D1 featured pricing migration failed: ${alter.error}`);
        }
      }
    })();
  }

  try {
    await pricingSchemaReady;
  } catch (error) {
    pricingSchemaReady = null;
    throw error;
  }
}

function imageUrlFromPath(path: string | null) {
  return path ? `/api/featured-images/${encodeURIComponent(path)}` : null;
}

function rowToWork(row: FeaturedRow): FeaturedWork {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    tag: row.tag || "Bespoke",
    year: row.year || new Date().getFullYear(),
    category: row.category || "Fabrication",
    fullStory: row.full_story || "",
    imagePath: row.image_url || imageUrlFromPath(row.image_path),
    priceExVat: typeof row.price_ex_vat === "number" ? row.price_ex_vat : null,
    hideExVat: row.hide_ex_vat === 1,
  };
}

function workToEntry(work: FeaturedWork): FeaturedEntry {
  return {
    id: work.id,
    title: work.title,
    description: work.description,
    tag: work.tag,
    year: work.year,
    category: work.category,
    fullStory: work.fullStory,
    image: work.imagePath || "",
    priceExVat: work.priceExVat,
    hideExVat: work.hideExVat,
  };
}

async function getFeaturedRow(id: string): Promise<FeaturedRow | null> {
  await ensureFeaturedPricingSchema();
  const db = await getD1();
  return db
    .prepare(
      `select fw.id,fw.title,fw.description,fw.tag,fw.year,fw.category,fw.full_story,
        fw.image_url,fw.image_path,fw.created_at,fwp.price_ex_vat,
        coalesce(fwp.hide_ex_vat, 0) as hide_ex_vat
       from featured_work fw
       left join featured_work_prices fwp on fwp.featured_id = fw.id
       where fw.id = ?`
    )
    .bind(id)
    .first<FeaturedRow>();
}

export async function listFeaturedWork(): Promise<FeaturedWork[]> {
  await ensureFeaturedPricingSchema();
  const db = await getD1();
  const result = await db
    .prepare(
      `select fw.id,fw.title,fw.description,fw.tag,fw.year,fw.category,fw.full_story,
        fw.image_url,fw.image_path,fw.created_at,fwp.price_ex_vat,
        coalesce(fwp.hide_ex_vat, 0) as hide_ex_vat
       from featured_work fw
       left join featured_work_prices fwp on fwp.featured_id = fw.id
       order by fw.created_at desc`
    )
    .all<FeaturedRow>();

  if (result.error) throw new Error(`D1 featured_work read failed: ${result.error}`);
  return (result.results || []).map(rowToWork);
}

export async function listFeaturedEntries(): Promise<FeaturedEntry[]> {
  const work = await listFeaturedWork();
  return work.map(workToEntry);
}

function extFromDataUrl(url: string): string | null {
  const m = url.match(/^data:image\/(jpe?g|png|webp|gif);base64,/i);
  if (!m) return null;
  const sub = m[1].toLowerCase();
  return sub === "jpeg" ? "jpg" : sub;
}

function contentTypeFromExt(ext: string) {
  return `image/${ext === "jpg" ? "jpeg" : ext}`;
}

function bytesFromDataUrl(url: string): Uint8Array {
  const idx = url.indexOf("base64,");
  if (idx < 0) throw new Error("Image isn't a base64 data URL");
  return new Uint8Array(Buffer.from(url.slice(idx + "base64,".length), "base64"));
}

export async function saveFeaturedEntry(input: {
  entry: Partial<FeaturedEntry>;
  imageDataUrl?: string;
}): Promise<FeaturedEntry> {
  const db = await getD1();
  const entry = input.entry;

  if (!entry.title) throw new Error("Missing title");

  let id = entry.id && !entry.id.startsWith("new-") ? safeId(entry.id) : "";
  if (!id) {
    const existing = await db.prepare("select id from featured_work").all<{ id: string }>();
    if (existing.error) throw new Error(`D1 featured_work id check failed: ${existing.error}`);
    const taken = new Set((existing.results || []).map((row) => row.id));
    let n = 1;
    while (taken.has(`f${String(n).padStart(3, "0")}`)) n++;
    id = `f${String(n).padStart(3, "0")}`;
  }

  const current = await getFeaturedRow(id);
  let imageUrl = current?.image_url || null;
  let imagePath = current?.image_path || null;
  const previousImagePath = current?.image_path || null;
  let uploadedImagePath: string | null = null;

  if (input.imageDataUrl) {
    const ext = extFromDataUrl(input.imageDataUrl);
    if (!ext) throw new Error("Image must be JPG, PNG, WebP, or GIF");

    const bytes = bytesFromDataUrl(input.imageDataUrl);
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Image is too large. Please use a photo under 5 MB.");
    }

    const bucket = await getFeaturedImagesBucket();
    imagePath = `${id}-${Date.now()}.${ext}`;
    uploadedImagePath = imagePath;
    imageUrl = null;
    await bucket.put(imagePath, bytes, {
      httpMetadata: { contentType: contentTypeFromExt(ext) },
    });
  } else if (entry.image?.startsWith("http://") || entry.image?.startsWith("https://")) {
    imageUrl = entry.image.trim();
  }

  const now = new Date().toISOString();
  const rawPrice = entry.priceExVat;
  const priceExVat = rawPrice === null || rawPrice === undefined
    ? null
    : Number(rawPrice);
  if (priceExVat !== null && (!Number.isFinite(priceExVat) || priceExVat < 0)) {
    throw new Error("Price must be a valid amount, or left blank.");
  }
  const hideExVat = entry.hideExVat === true;
  const result = await db
    .prepare(
      `
      insert into featured_work (
        id,
        title,
        description,
        tag,
        year,
        category,
        full_story,
        image_url,
        image_path,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        title = excluded.title,
        description = excluded.description,
        tag = excluded.tag,
        year = excluded.year,
        category = excluded.category,
        full_story = excluded.full_story,
        image_url = excluded.image_url,
        image_path = excluded.image_path,
        updated_at = excluded.updated_at
      `
    )
    .bind(
      id,
      String(entry.title).trim(),
      String(entry.description || "").trim(),
      String(entry.tag || "Bespoke").trim(),
      Number.isFinite(entry.year as number)
        ? Number(entry.year)
        : current?.year || new Date().getFullYear(),
      String(entry.category || "Fabrication").trim(),
      String(entry.fullStory || "").trim(),
      imageUrl,
      imagePath,
      current?.created_at || now,
      now
    )
    .run();

  if (result.error) {
    if (uploadedImagePath) {
      try {
        const bucket = await getFeaturedImagesBucket();
        await bucket.delete(uploadedImagePath);
      } catch {
        // The database error is the useful failure to report.
      }
    }
    throw new Error(`D1 featured_work save failed: ${result.error}`);
  }

  const priceResult = await db.prepare(`
        insert into featured_work_prices (featured_id, price_ex_vat, hide_ex_vat, updated_at)
        values (?, ?, ?, ?)
        on conflict(featured_id) do update set
          price_ex_vat = excluded.price_ex_vat,
          hide_ex_vat = excluded.hide_ex_vat,
          updated_at = excluded.updated_at
      `).bind(id, priceExVat, hideExVat ? 1 : 0, now).run();
  if (priceResult.error) {
    throw new Error(`D1 featured price save failed: ${priceResult.error}`);
  }

  const saved = await getFeaturedRow(id);
  if (!saved) throw new Error("D1 featured_work save failed: saved row could not be read.");
  if (previousImagePath && previousImagePath !== imagePath) {
    try {
      const bucket = await getFeaturedImagesBucket();
      await bucket.delete(previousImagePath);
    } catch {
      // The new database row and image are already valid; stale cleanup can wait.
    }
  }
  return workToEntry(rowToWork(saved));
}

export async function deleteFeaturedEntry(id: string): Promise<void> {
  const safe = safeId(id);
  const current = await getFeaturedRow(safe);
  const db = await getD1();
  const result = await db.prepare("delete from featured_work where id = ?").bind(safe).run();

  if (result.error) throw new Error(`D1 featured_work delete failed: ${result.error}`);
  const priceResult = await db.prepare("delete from featured_work_prices where featured_id = ?").bind(safe).run();
  if (priceResult.error) throw new Error(`D1 featured price delete failed: ${priceResult.error}`);

  if (current?.image_path) {
    try {
      const bucket = await getFeaturedImagesBucket();
      await bucket.delete(current.image_path);
    } catch {
      // The row is already deleted; a stale image object is not worth failing the request.
    }
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || `f${Date.now()}`;
}
