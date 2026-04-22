import { NextResponse } from "next/server";
import { products } from "@/lib/mini-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  const search = searchParams.get("q");

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

  return NextResponse.json({ products: list, count: list.length });
}
