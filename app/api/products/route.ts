import { NextResponse } from "next/server";
import { products } from "@/lib/mini-data";
import { metals } from "@/lib/metals-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  const search = searchParams.get("q");
  const catalogue = searchParams.get("catalogue") || "mini";
  const offset = Math.max(0, Math.floor(Number(searchParams.get("offset")) || 0));
  const limit = Math.max(1, Math.min(200, Math.floor(Number(searchParams.get("limit")) || 120)));

  if (catalogue === "metals") {
    const category = searchParams.get("category");
    let list = metals;
    if (category && category !== "all") list = list.filter((product) => product.category === category);
    if (search?.trim()) {
      const query = search.trim().toLowerCase();
      list = list.filter((product) =>
        [product.form, product.metal, product.spec, product.size, product.unit, product.code, product.sourceSheet]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    return NextResponse.json(
      { products: list.slice(offset, offset + limit), count: list.length, total: metals.length },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  }

  let list = products;
  if (section && section !== "all") list = list.filter((p) => p.section === section);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.fits.toLowerCase().includes(q)
    );
  }

  const count = list.length;
  return NextResponse.json({ products: list.slice(offset, offset + limit), count, total: products.length });
}
