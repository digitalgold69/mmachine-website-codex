import Link from "next/link";
import { countNewQuoteRequests } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let newRequestCount = 0;

  try {
    newRequestCount = await countNewQuoteRequests();
  } catch {
    newRequestCount = 0;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream">
      <header className="bg-racing text-cream border-b border-racing-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-racing-dark font-bold text-sm">
              M
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg leading-none">Owner dashboard</div>
              <div className="text-xs opacity-70 mt-1">M-Machine admin</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <Link href="/" className="text-cream/80 hover:text-gold">Back to website</Link>
            <span className="text-cream/40">|</span>
            <Link href="/dashboard/login" className="text-cream/80 hover:text-gold">Sign out</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="grid grid-cols-2 gap-1 mb-6 overflow-hidden rounded-lg border border-racing/10 bg-white p-1 sm:flex sm:flex-wrap">
          <Link href="/dashboard" className="inline-flex min-w-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-racing hover:bg-cream-dark sm:px-4">
            Overview
          </Link>
          <Link href="/dashboard/products" className="inline-flex min-w-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-racing hover:bg-cream-dark sm:px-4">
            Products
          </Link>
          <Link href="/dashboard/orders" className="inline-flex min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-racing hover:bg-cream-dark sm:px-4">
            <span className="truncate">Quote requests</span>
            {newRequestCount > 0 && (
              <span
                aria-label={`${newRequestCount} new quote requests`}
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold leading-none text-racing-dark"
              >
                {newRequestCount > 99 ? "99+" : newRequestCount}
              </span>
            )}
          </Link>
          <Link href="/dashboard/featured" className="inline-flex min-w-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-racing hover:bg-cream-dark sm:px-4">
            Featured work
          </Link>
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
