import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Result<T = unknown> = {
  results?: T[];
  success?: boolean;
  error?: string;
};

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = unknown>() => Promise<D1Result<T>>;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<D1Result>;
};

export type D1DatabaseBinding = {
  prepare: (query: string) => D1Statement;
};

export type R2BucketBinding = {
  get: (key: string) => Promise<{
    body: ReadableStream | null;
    httpMetadata?: { contentType?: string };
    writeHttpMetadata?: (headers: Headers) => void;
  } | null>;
  put: (
    key: string,
    value: Uint8Array | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } }
  ) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
  createMultipartUpload: (
    key: string,
    options?: { httpMetadata?: { contentType?: string } }
  ) => Promise<R2MultipartUploadBinding>;
  resumeMultipartUpload: (key: string, uploadId: string) => R2MultipartUploadBinding;
};

export type R2UploadedPartBinding = { partNumber: number; etag: string };

export type R2MultipartUploadBinding = {
  key: string;
  uploadId: string;
  uploadPart: (
    partNumber: number,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob
  ) => Promise<R2UploadedPartBinding>;
  abort: () => Promise<void>;
  complete: (parts: R2UploadedPartBinding[]) => Promise<{ size: number }>;
};

export type EmailAddressBinding = string | { email: string; name?: string };

export type SendEmailBinding = {
  send: (message: {
    to: EmailAddressBinding | EmailAddressBinding[];
    from: EmailAddressBinding;
    subject: string;
    html?: string;
    text?: string;
    cc?: EmailAddressBinding | EmailAddressBinding[];
    bcc?: EmailAddressBinding | EmailAddressBinding[];
    replyTo?: EmailAddressBinding;
    headers?: Record<string, string>;
  }) => Promise<{ messageId: string }>;
};

export type MMachineCloudflareEnv = {
  DB?: D1DatabaseBinding;
  EMAIL?: SendEmailBinding;
  FEATURED_IMAGES?: R2BucketBinding;
  QUOTE_FILES?: R2BucketBinding;
};

export async function getCloudflareEnv(): Promise<MMachineCloudflareEnv> {
  const context = await getCloudflareContext({ async: true });
  return context.env as MMachineCloudflareEnv;
}

export async function getD1(): Promise<D1DatabaseBinding> {
  const env = await getCloudflareEnv();
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding DB is missing.");
  }
  return env.DB;
}

export async function getFeaturedImagesBucket(): Promise<R2BucketBinding> {
  const env = await getCloudflareEnv();
  if (!env.FEATURED_IMAGES) {
    throw new Error("Cloudflare R2 binding FEATURED_IMAGES is missing.");
  }
  return env.FEATURED_IMAGES;
}

export async function getQuoteFilesBucket(): Promise<R2BucketBinding> {
  const env = await getCloudflareEnv();
  if (!env.QUOTE_FILES) {
    throw new Error("Cloudflare R2 binding QUOTE_FILES is missing.");
  }
  return env.QUOTE_FILES;
}

export async function getSendEmailBinding(): Promise<SendEmailBinding | undefined> {
  const env = await getCloudflareEnv();
  return env.EMAIL;
}
