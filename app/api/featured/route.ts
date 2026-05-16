// /api/featured
//
// Runtime dashboard CMS for featured work. Text is stored in Supabase
// Postgres and images are stored in Supabase Storage, so owner edits update
// immediately without committing to GitHub or waiting for a Vercel rebuild.

import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import {
  deleteFeaturedEntry,
  listFeaturedEntries,
  saveFeaturedEntry,
  type FeaturedEntry,
} from "@/lib/featured";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const entries = await listFeaturedEntries();
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  let body: { entry?: Partial<FeaturedEntry>; imageDataUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const entry = await saveFeaturedEntry({
      entry: body.entry || {},
      imageDataUrl: body.imageDataUrl,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Save failed" },
      { status: 500 }
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
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await deleteFeaturedEntry(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Delete failed" },
      { status: 500 }
    );
  }
}
