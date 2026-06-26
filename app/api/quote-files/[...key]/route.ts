import { requireLogin } from "@/lib/auth";
import { getQuoteFilesBucket } from "@/lib/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDownloadName(key: string) {
  const last = key.split("/").pop() || "drawing";
  return last
    .replace(/^[0-9a-f-]{24,}-/i, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .trim() || "drawing";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const auth = await requireLogin();
  if (auth) return auth;

  const { key: segments } = await params;
  const key = (segments || []).join("/");
  if (!key || !key.startsWith("quote-requests/")) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = await getQuoteFilesBucket();
  const object = await bucket.get(key);
  if (!object || !object.body) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  if (object.writeHttpMetadata) {
    object.writeHttpMetadata(headers);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  }
  headers.set("Content-Disposition", `attachment; filename="${safeDownloadName(key).replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, no-store");

  return new Response(object.body, { headers });
}
