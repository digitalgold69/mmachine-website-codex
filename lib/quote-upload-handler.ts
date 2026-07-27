import type { R2BucketBinding, R2UploadedPartBinding } from "./cloudflare";
import type { QuoteFile } from "./quote-types";
import {
  makeCompletedFileToken,
  makeUploadSessionToken,
  readUploadSessionToken,
  type UploadSession,
} from "./quote-upload-token";

export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const UPLOAD_PART_BYTES = 8 * 1024 * 1024;

export class QuoteUploadClientError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "QuoteUploadClientError";
    this.status = status;
  }
}

export type QuoteUploadActionBody = {
  action?: "start" | "complete" | "abort";
  name?: string;
  size?: number;
  type?: string;
  token?: string;
  parts?: { partNumber?: number; etag?: string }[];
};

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

export function expectedPartCount(session: Pick<UploadSession, "size" | "partSize">) {
  return Math.ceil(session.size / session.partSize);
}

export function expectedPartBytes(
  session: Pick<UploadSession, "size" | "partSize">,
  partNumber: number
) {
  const partCount = expectedPartCount(session);
  if (partNumber < 1 || partNumber > partCount) {
    throw new QuoteUploadClientError("Invalid file part.");
  }
  return partNumber === partCount
    ? session.size - session.partSize * (partCount - 1)
    : session.partSize;
}

export function validateUploadPartBytes(
  session: Pick<UploadSession, "size" | "partSize">,
  partNumber: number,
  actualBytes: number
) {
  const expectedBytes = expectedPartBytes(session, partNumber);
  if (actualBytes !== expectedBytes) {
    throw new QuoteUploadClientError("Invalid file part.");
  }
  return expectedBytes;
}

function readUploadToken(token: unknown) {
  try {
    return readUploadSessionToken(String(token || ""));
  } catch {
    throw new QuoteUploadClientError("Invalid upload session.");
  }
}

export function readQuoteUploadSession(token: unknown) {
  return readUploadToken(token);
}

export async function startQuoteUpload(body: QuoteUploadActionBody, bucket: R2BucketBinding) {
  const name = cleanFileName(body.name);
  const size = Math.floor(Number(body.size) || 0);
  const type = safeType(body.type);
  if (size < 1 || size > MAX_FILE_BYTES) {
    throw new QuoteUploadClientError("Each file must be no larger than 2 GB.");
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
  return { token };
}

export async function abortQuoteUpload(body: QuoteUploadActionBody, bucket: R2BucketBinding) {
  const session = readUploadToken(body.token);
  const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
  await upload.abort();
  return { ok: true };
}

function normaliseCompletedParts(parts: QuoteUploadActionBody["parts"], expectedCount: number) {
  const completedParts = Array.isArray(parts)
    ? parts
        .map((part) => ({ partNumber: Math.floor(Number(part.partNumber)), etag: String(part.etag || "") }))
        .filter((part) => part.partNumber > 0 && part.etag)
        .sort((a, b) => a.partNumber - b.partNumber)
    : [];
  const partsAreComplete =
    completedParts.length === expectedCount &&
    completedParts.every((part, index) => part.partNumber === index + 1);
  if (!partsAreComplete) {
    throw new QuoteUploadClientError("The uploaded file is incomplete.");
  }
  return completedParts;
}

export async function completeQuoteUpload(body: QuoteUploadActionBody, bucket: R2BucketBinding) {
  const session = readUploadToken(body.token);
  const parts = normaliseCompletedParts(body.parts, expectedPartCount(session));
  const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
  const completed = await upload.complete(parts);
  if (completed.size !== session.size) {
    await bucket.delete(session.key);
    throw new QuoteUploadClientError("The uploaded file size did not match the selected file.");
  }

  const file: QuoteFile = {
    key: session.key,
    name: session.name,
    size: session.size,
    type: session.type,
    extension: extension(session.name),
    uploadedAt: new Date().toISOString(),
  };
  return { file: { ...file, token: makeCompletedFileToken(file) } };
}

export async function uploadQuoteFilePart(
  token: string,
  partNumber: number,
  body: ArrayBuffer,
  bucket: R2BucketBinding
): Promise<R2UploadedPartBinding> {
  const session = readUploadToken(token);
  validateUploadPartBytes(session, partNumber, body.byteLength);
  const upload = bucket.resumeMultipartUpload(session.key, session.uploadId);
  return upload.uploadPart(partNumber, body);
}
