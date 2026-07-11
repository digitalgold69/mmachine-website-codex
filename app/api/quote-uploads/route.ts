import { NextResponse } from "next/server";
import { getQuoteFilesBucket } from "@/lib/cloudflare";
import { checkRateLimit } from "@/lib/request-limits";
import {
  makeCompletedFileToken,
  makeUploadSessionToken,
  readUploadSessionToken,
} from "@/lib/quote-upload-token";
import type { QuoteFile } from "@/lib/quote-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const UPLOAD_PART_BYTES = 8 * 1024 * 1024;

function cleanFileName(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "drawing";
}

function extension(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
}

function safeType(value: unknown) {
  return String(value || "application/octet-stream").slice(0, 160);
}

export async function POST(request: Request) {
  let body: {
    action?: "start" | "complete" | "abort";
    name?: string;
    size?: number;
    type?: string;
    token?: string;
    parts?: { partNumber?: number; etag?: string }[];
  };
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

      const name = cleanFileName(body.name);
      const size = Math.floor(Number(body.size) || 0);
      const type = safeType(body.type);
      if (size < 1 || size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Each file must be no larger than 2 GB." }, { status: 400 });
      }

      const key = `quote-uploads/${crypto.randomUUID()}/${crypto.randomUUID()}-${name}`;
      const upload = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: type } });
      const token = makeUploadSessionToken({
        key,
        uploadId: upload.uploadId,
        partSize: UPLOAD_PART_BYTES,
        name,
        size,
        type,
      });
      return NextResponse.json({ token });
    }

    const session = readUploadSessionToken(String(body.token || ""));
    const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);

    if (body.action === "abort") {
      await upload.abort();
      return NextResponse.json({ ok: true });
    }

    if (body.action === "complete") {
      const expectedPartCount = Math.ceil(session.size / session.partSize);
      const parts = Array.isArray(body.parts)
        ? body.parts
            .map((part) => ({ partNumber: Math.floor(Number(part.partNumber)), etag: String(part.etag || "") }))
            .filter((part) => part.partNumber > 0 && part.etag)
            .sort((a, b) => a.partNumber - b.partNumber)
        : [];
      const partsAreComplete =
        parts.length === expectedPartCount &&
        parts.every((part, index) => part.partNumber === index + 1);
      if (!partsAreComplete) {
        return NextResponse.json({ error: "The uploaded file is incomplete." }, { status: 400 });
      }
      const completed = await upload.complete(parts);
      if (completed.size !== session.size) {
        await bucket.delete(session.key);
        return NextResponse.json({ error: "The uploaded file size did not match the selected file." }, { status: 400 });
      }

      const file: QuoteFile = {
        key: session.key,
        name: session.name,
        size: session.size,
        type: session.type,
        extension: extension(session.name),
        uploadedAt: new Date().toISOString(),
      };
      return NextResponse.json({ file: { ...file, token: makeCompletedFileToken(file) } });
    }

    return NextResponse.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) {
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
    const session = readUploadSessionToken(url.searchParams.get("token") || "");
    const partNumber = Math.floor(Number(url.searchParams.get("partNumber")) || 0);
    const contentLength = Number(request.headers.get("content-length") || 0);
    const expectedPartCount = Math.ceil(session.size / session.partSize);
    const expectedPartBytes = partNumber === expectedPartCount
      ? session.size - session.partSize * (expectedPartCount - 1)
      : session.partSize;
    if (
      partNumber < 1 ||
      partNumber > expectedPartCount ||
      (contentLength > 0 && contentLength !== expectedPartBytes) ||
      !request.body
    ) {
      return NextResponse.json({ error: "Invalid file part." }, { status: 400 });
    }

    const bucket = await getQuoteFilesBucket();
    const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    return NextResponse.json(part);
  } catch (error) {
    console.error("quote_upload_part_failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json({ error: "A file part could not be uploaded. Please try again." }, { status: 500 });
  }
}
