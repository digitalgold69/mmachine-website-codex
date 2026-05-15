import Link from "next/link";
import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { products } from "@/lib/mini-data";
import { featuredWork } from "@/lib/featured-data";

export default async function DashboardHomePage() {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  const total = products.length;
  const inStock = products.filter((p) => p.stock === "in").length;
  const lowStock = products.filter((p) => p.stock === "low").length;
  const outOfStock = products.filter((p) => p.stock === "out").length;
  const featuredCount = featuredWork.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing mb-1">Good morning 👋</h1>
        <p className="text-ink-muted">Here&apos;s what&apos;s happening in the catalogue today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-racing/10">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">Total products</div>
          <div className="font-display text-3xl text-racing">{total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-racing/10">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">In stock</div>
          <div className="font-display text-3xl text-racing">{inStock.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-racing/10">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">Low stock</div>
          <div className="font-display text-3xl" style={{ color: "#B8860B" }}>{lowStock}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-racing/10">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">Out of stock</div>
          <div className="font-display text-3xl" style={{ color: "#A32D2D" }}>{outOfStock}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/dashboard/orders" className="card bg-white group block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-racing">Quote requests</h2>
            <span className="text-xs font-mono text-gold">NEW</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Review website carts, adjust carriage or notes, and email the quote to the buyer.
          </p>
          <span className="text-sm font-medium text-racing group-hover:text-gold">Open quote requests →</span>
        </Link>

        <Link href="/dashboard/products" className="card bg-white group block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-racing">Manage products</h2>
            <span className="text-xs font-mono text-gold">{total} ITEMS</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Search, edit and update all {total} products in the catalogue.
            Change prices, update stock levels, add new parts.
          </p>
          <span className="text-sm font-medium text-racing group-hover:text-gold">Open products →</span>
        </Link>

        <Link href="/dashboard/featured" className="card bg-white group block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-racing">Featured workshop jobs</h2>
            <span className="text-xs font-mono text-gold">{featuredCount} JOBS</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Showcase bespoke fabrication, restoration and one-off work. Add photos and stories.
          </p>
          <span className="text-sm font-medium text-racing group-hover:text-gold">Open featured work →</span>
        </Link>
      </div>

      <div className="mt-6 bg-cream-dark rounded-xl p-6 border-l-4 border-gold">
        <h3 className="font-display text-lg text-racing mb-2">How this works</h3>
        <p className="text-sm text-ink-muted leading-relaxed">
          Changes you make here update the website instantly. The PDF catalogue regenerates automatically
          each night, so you never need to email a new PDF or re-upload anything. If you need help,
          phone the developer on the number in your welcome email.
        </p>
      </div>
    </div>
  );
}
