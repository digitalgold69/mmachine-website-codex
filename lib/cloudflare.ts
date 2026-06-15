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
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } }
  ) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

export type MMachineCloudflareEnv = {
  DB?: D1DatabaseBinding;
  FEATURED_IMAGES?: R2BucketBinding;
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
