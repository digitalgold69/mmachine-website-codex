import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // In production: send email via Resend/SendGrid, or write to a database.
    // For now, just log it so the demo works end-to-end.
    console.log("ENQUIRY RECEIVED:", {
      name: data.name,
      email: data.email,
      phone: data.phone,
      type: data.type,
      message: data.message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
