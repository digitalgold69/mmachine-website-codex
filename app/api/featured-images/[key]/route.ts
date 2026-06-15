import { getFeaturedImagesBucket } from "@/lib/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> | { key: string } }
) {
  const params = await context.params;
  const key = decodeURIComponent(params.key || "");

  if (!key || key.includes("/") || key.includes("\\")) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = await getFeaturedImagesBucket();
  const object = await bucket.get(key);

  if (!object?.body) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  if (object.writeHttpMetadata) object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", object.httpMetadata?.contentType || "application/octet-stream");
  }
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
