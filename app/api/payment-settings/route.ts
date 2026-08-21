import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { getPaymentSettings, savePaymentSettings, type PaymentSettings } from "@/lib/payment-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireLogin();
  if (auth) return auth;
  return NextResponse.json({ settings: await getPaymentSettings() });
}

export async function POST(req: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as Partial<PaymentSettings>;
  const settings = await savePaymentSettings(body);
  return NextResponse.json({ ok: true, settings });
}
