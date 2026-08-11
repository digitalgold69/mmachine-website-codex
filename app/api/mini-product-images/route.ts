import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import {
  deleteMiniProductImage,
  listMiniProductImages,
  saveMiniProductImage,
} from "@/lib/mini-product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const images = await listMiniProductImages();
    return NextResponse.json(
      { images },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: { productId?: string; imageDataUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!body.productId || !body.imageDataUrl) {
    return NextResponse.json({ error: "Missing product image details" }, { status: 400 });
  }

  try {
    const image = await saveMiniProductImage({
      productId: body.productId,
      imageDataUrl: body.imageDataUrl,
    });
    return NextResponse.json({ ok: true, image });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: { productId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!body.productId) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  try {
    await deleteMiniProductImage(body.productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Delete failed" }, { status: 500 });
  }
}
