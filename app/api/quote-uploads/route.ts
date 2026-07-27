import { NextResponse } from "next/server";
import { getQuoteFilesBucket } from "@/lib/cloudflare";
import { checkRateLimit } from "@/lib/request-limits";
import {
  abortQuoteUpload,
  completeQuoteUpload,
  expectedPartBytes,
  QuoteUploadClientError,
  readQuoteUploadSession,
  startQuoteUpload,
  uploadQuoteFilePart,
  type QuoteUploadActionBody,
} from "@/lib/quote-upload-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: QuoteUploadActionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    const bucket = await getQuoteFilesBucket();

    if (body.action === "start") {
      const rateLimit = await checkRateLimit(request, "quote-upload-start", 30, 60 * 60);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many uploads have been started. Please wait and try again." },
          { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
        );
      }
      return NextResponse.json(await startQuoteUpload(body, bucket));
    }

    if (body.action === "abort") {
      return NextResponse.json(await abortQuoteUpload(body, bucket));
    }

    if (body.action === "complete") {
      return NextResponse.json(await completeQuoteUpload(body, bucket));
    }

    return NextResponse.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) {
    if (error instanceof QuoteUploadClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("quote_upload_action_failed", {
      action: body.action,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json({ error: "The file upload could not be completed. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || "";
    const session = readQuoteUploadSession(token);
    const partNumber = Math.floor(Number(url.searchParams.get("partNumber")) || 0);
    const contentLength = Number(request.headers.get("content-length") || 0);
    const partBytes = expectedPartBytes(session, partNumber);
    if (contentLength > 0 && contentLength !== partBytes) {
      return NextResponse.json({ error: "Invalid file part." }, { status: 400 });
    }

    const bucket = await getQuoteFilesBucket();
    const body = await request.arrayBuffer();
    const part = await uploadQuoteFilePart(token, partNumber, body, bucket);
    return NextResponse.json(part);
  } catch (error) {
    if (error instanceof QuoteUploadClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("quote_upload_part_failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json({ error: "A file part could not be uploaded. Please try again." }, { status: 500 });
  }
}
