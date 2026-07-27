import crypto from "node:crypto";
import type { QuoteFile } from "@/lib/quote-types";

export type UploadSession = {
  purpose: "upload";
  key: string;
  uploadId: string;
  partSize: number;
  name: string;
  size: number;
  type: string;
  exp: number;
};

type CompletedFile = QuoteFile & {
  purpose: "completed";
  exp: number;
};

function secret() {
  const value =
    process.env.QUOTE_UPLOAD_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.OWNER_PASSWORD?.trim();
  if (!value || value.length < 12) throw new Error("Quote upload signing secret is unavailable.");
  return value;
}

function encode(payload: UploadSession | CompletedFile) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function decode(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Invalid upload token.");
  const expected = crypto.createHmac("sha256", secret()).update(encoded).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid upload token.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UploadSession | CompletedFile;
  if (!payload.exp || payload.exp < Date.now()) throw new Error("Upload token has expired.");
  return payload;
}

export function makeUploadSessionToken(input: Omit<UploadSession, "purpose" | "exp">) {
  return encode({ ...input, purpose: "upload", exp: Date.now() + 2 * 60 * 60 * 1000 });
}

export function readUploadSessionToken(token: string): UploadSession {
  const payload = decode(token);
  if (payload.purpose !== "upload") throw new Error("Invalid upload token.");
  return payload;
}

export function makeCompletedFileToken(file: QuoteFile) {
  return encode({ ...file, purpose: "completed", exp: Date.now() + 48 * 60 * 60 * 1000 });
}

export function readCompletedFileToken(token: string): QuoteFile {
  const payload = decode(token);
  if (payload.purpose !== "completed") throw new Error("Invalid file token.");
  const { purpose: _purpose, exp: _exp, ...file } = payload;
  return file;
}
