import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import {
  deleteManualMiniProduct,
  listManualMiniProducts,
  saveManualMiniProduct,
} from "@/lib/manual-mini-products";
import { deleteMiniProductImage } from "@/lib/mini-product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function asPrice(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const products = await listManualMiniProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Manual Mini parts could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: {
    id?: string;
    code?: string;
    name?: string;
    section?: string;
    fits?: string;
    priceExVat?: string | number | null;
    active?: boolean;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const product = await saveManualMiniProduct({
      id: asString(body.id, 120),
      code: asString(body.code, 80),
      name: asString(body.name, 240),
      section: asString(body.section, 20),
      fits: asString(body.fits, 500),
      priceExVat: asPrice(body.priceExVat),
      active: body.active !== false,
    });
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Manual Mini part could not be saved." },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "Missing manual Mini part id." }, { status: 400 });

  try {
    try {
      await deleteMiniProductImage(body.id);
    } catch (error) {
      console.error("manual_mini_product_image_cleanup_failed", {
        productId: body.id,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
    await deleteManualMiniProduct(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Manual Mini part could not be deleted." },
      { status: 400 }
    );
  }
}
