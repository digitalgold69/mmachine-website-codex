import { getMiniProductImageObject } from "@/lib/mini-product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  const params = await context.params;
  const productId = decodeURIComponent(params.productId || "");
  if (!productId || productId.includes("/") || productId.includes("\\")) {
    return new Response("Not found", { status: 404 });
  }

  const image = await getMiniProductImageObject(productId);
  if (!image?.object?.body) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  if (image.object.writeHttpMetadata) image.object.writeHttpMetadata(headers);
  headers.set("content-type", image.contentType || image.object.httpMetadata?.contentType || "image/webp");
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(image.object.body, { headers });
}
