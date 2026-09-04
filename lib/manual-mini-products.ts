import { getD1 } from "@/lib/cloudflare";
import { sections, type Product } from "@/lib/mini-data";
import { MANUAL_MINI_SECTION_CODE } from "@/lib/manual-mini-product-shared";

export type ManualMiniProductInput = {
  code: string;
  name: string;
  section: string;
  fits?: string;
  priceExVat?: number | null;
  active?: boolean;
};

type ManualMiniProductRow = {
  id: string;
  code: string;
  name: string;
  section: string;
  fits: string | null;
  price_ex_vat: number | null;
  active: number | string | boolean | null;
  created_at: string;
  updated_at: string;
};

let schemaReady: Promise<void> | null = null;

async function ensureManualMiniProductSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await getD1();
      const result = await db.prepare(`
        create table if not exists manual_mini_products (
          id text primary key,
          code text not null,
          name text not null,
          section text not null,
          fits text not null default '',
          price_ex_vat real,
          active integer not null default 1,
          created_at text not null,
          updated_at text not null
        )
      `).run();
      if (result.error) throw new Error(`D1 manual Mini product setup failed: ${result.error}`);
    })();
  }

  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

function asBool(value: unknown) {
  return value === 1 || value === true || value === "1";
}

function cleanText(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function safeSection(value: string) {
  const clean = cleanText(value, 20);
  if (clean === MANUAL_MINI_SECTION_CODE) return clean;
  return sections.some((section) => section.code === clean) ? clean : MANUAL_MINI_SECTION_CODE;
}

function manualId() {
  return `manual-mini-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function rowToProduct(row: ManualMiniProductRow): Product {
  const priceExVat = typeof row.price_ex_vat === "number" && Number.isFinite(row.price_ex_vat)
    ? Number(row.price_ex_vat.toFixed(2))
    : null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    section: safeSection(row.section),
    fits: row.fits || "",
    bodyType: null,
    mark: null,
    hand: null,
    priceExVat,
    priceIncVat: typeof priceExVat === "number" ? Number((priceExVat * 1.2).toFixed(2)) : null,
    stock: "in",
    stockQty: 0,
    category: "mini",
  };
}

function normaliseInput(input: ManualMiniProductInput) {
  const code = cleanText(input.code, 80);
  const name = cleanText(input.name, 240);
  if (!code) throw new Error("Enter a part number.");
  if (!name) throw new Error("Enter a description.");

  const price = input.priceExVat;
  const priceExVat =
    typeof price === "number" && Number.isFinite(price) && price >= 0
      ? Number(price.toFixed(2))
      : null;

  return {
    code,
    name,
    section: safeSection(input.section),
    fits: cleanText(input.fits || "", 500),
    priceExVat,
    active: input.active !== false,
  };
}

export async function listManualMiniProducts(options: { activeOnly?: boolean } = {}) {
  await ensureManualMiniProductSchema();
  const db = await getD1();
  const where = options.activeOnly ? "where active = 1" : "";
  const result = await db
    .prepare(`
      select id, code, name, section, fits, price_ex_vat, active, created_at, updated_at
      from manual_mini_products
      ${where}
      order by updated_at desc, created_at desc
    `)
    .all<ManualMiniProductRow>();

  if (result.error) throw new Error(`D1 manual Mini product read failed: ${result.error}`);
  return (result.results || []).map((row) => ({
    ...rowToProduct(row),
    active: asBool(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getManualMiniProduct(productId: string): Promise<Product | null> {
  const id = cleanText(productId, 120);
  if (!id.startsWith("manual-mini-")) return null;

  await ensureManualMiniProductSchema();
  const db = await getD1();
  const row = await db
    .prepare(`
      select id, code, name, section, fits, price_ex_vat, active, created_at, updated_at
      from manual_mini_products
      where id = ?
    `)
    .bind(id)
    .first<ManualMiniProductRow>();

  return row ? rowToProduct(row) : null;
}

export async function saveManualMiniProduct(input: ManualMiniProductInput & { id?: string }) {
  const product = normaliseInput(input);
  const now = new Date().toISOString();
  const id = input.id?.startsWith("manual-mini-") ? cleanText(input.id, 120) : manualId();

  await ensureManualMiniProductSchema();
  const db = await getD1();
  const result = await db
    .prepare(`
      insert into manual_mini_products (
        id, code, name, section, fits, price_ex_vat, active, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        code = excluded.code,
        name = excluded.name,
        section = excluded.section,
        fits = excluded.fits,
        price_ex_vat = excluded.price_ex_vat,
        active = excluded.active,
        updated_at = excluded.updated_at
    `)
    .bind(
      id,
      product.code,
      product.name,
      product.section,
      product.fits,
      product.priceExVat,
      product.active ? 1 : 0,
      now,
      now
    )
    .run();

  if (result.error) throw new Error(`D1 manual Mini product save failed: ${result.error}`);
  return {
    ...rowToProduct({
      id,
      code: product.code,
      name: product.name,
      section: product.section,
      fits: product.fits,
      price_ex_vat: product.priceExVat,
      active: product.active ? 1 : 0,
      created_at: now,
      updated_at: now,
    }),
    active: product.active,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteManualMiniProduct(productId: string) {
  const id = cleanText(productId, 120);
  if (!id.startsWith("manual-mini-")) throw new Error("Manual Mini part not found.");

  await ensureManualMiniProductSchema();
  const db = await getD1();
  const result = await db
    .prepare("delete from manual_mini_products where id = ?")
    .bind(id)
    .run();
  if (result.error) throw new Error(`D1 manual Mini product delete failed: ${result.error}`);
}
