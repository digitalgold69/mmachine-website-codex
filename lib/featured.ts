import { getSupabaseAdmin } from "@/lib/supabase";

export type FeaturedWork = {
  id: string;
  title: string;
  description: string;
  tag: string;
  year: number;
  category: string;
  fullStory: string;
  imagePath: string | null;
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
};

const BUCKET = "featured-work";

function rowToWork(row: FeaturedRow): FeaturedWork {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    tag: row.tag || "Bespoke",
    year: row.year || new Date().getFullYear(),
    category: row.category || "Fabrication",
    fullStory: row.full_story || "",
    imagePath: row.image_url || null,
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
  };
}

export async function listFeaturedWork(): Promise<FeaturedWork[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("featured_work")
    .select("id,title,description,tag,year,category,full_story,image_url,image_path")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Supabase featured_work read failed: ${error.message}`);
  return (data || []).map((row) => rowToWork(row as FeaturedRow));
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

function bytesFromDataUrl(url: string): Uint8Array {
  const idx = url.indexOf("base64,");
  if (idx < 0) throw new Error("Image isn't a base64 data URL");
  return new Uint8Array(Buffer.from(url.slice(idx + "base64,".length), "base64"));
}

async function ensureFeaturedBucket() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Supabase storage setup failed: ${error.message}`);
  }
}

export async function saveFeaturedEntry(input: {
  entry: Partial<FeaturedEntry>;
  imageDataUrl?: string;
}): Promise<FeaturedEntry> {
  const supabase = getSupabaseAdmin();
  const entry = input.entry;

  if (!entry.title) throw new Error("Missing title");

  let id = entry.id && !entry.id.startsWith("new-") ? safeId(entry.id) : "";
  if (!id) {
    const { data, error } = await supabase.from("featured_work").select("id");
    if (error) throw new Error(`Supabase featured_work id check failed: ${error.message}`);
    const taken = new Set((data || []).map((row) => row.id as string));
    let n = 1;
    while (taken.has(`f${String(n).padStart(3, "0")}`)) n++;
    id = `f${String(n).padStart(3, "0")}`;
  }

  let imageUrl = (entry.image || "").trim();
  let imagePath: string | null = null;

  if (input.imageDataUrl) {
    const ext = extFromDataUrl(input.imageDataUrl);
    if (!ext) throw new Error("Image must be JPG, PNG, WebP, or GIF");

    const bytes = bytesFromDataUrl(input.imageDataUrl);
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Image is too large. Please use a photo under 5 MB.");
    }

    await ensureFeaturedBucket();
    imagePath = `${id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(imagePath, bytes, {
        contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Supabase image upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
    imageUrl = data.publicUrl;
  }

  const row = {
    id,
    title: String(entry.title).trim(),
    description: String(entry.description || "").trim(),
    tag: String(entry.tag || "Bespoke").trim(),
    year: Number.isFinite(entry.year as number) ? Number(entry.year) : new Date().getFullYear(),
    category: String(entry.category || "Fabrication").trim(),
    full_story: String(entry.fullStory || "").trim(),
    image_url: imageUrl || null,
    image_path: imagePath,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("featured_work")
    .upsert(row, { onConflict: "id" })
    .select("id,title,description,tag,year,category,full_story,image_url,image_path")
    .single();

  if (error) throw new Error(`Supabase featured_work save failed: ${error.message}`);
  return workToEntry(rowToWork(data as FeaturedRow));
}

export async function deleteFeaturedEntry(id: string): Promise<void> {
  const safe = safeId(id);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("featured_work").delete().eq("id", safe);
  if (error) throw new Error(`Supabase featured_work delete failed: ${error.message}`);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || `f${Date.now()}`;
}

