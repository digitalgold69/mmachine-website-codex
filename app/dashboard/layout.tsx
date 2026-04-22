import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-racing text-cream border-b border-racing-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-racing-dark font-bold text-sm">M</div>
            <div>
              <div className="font-display text-lg leading-none">Owner dashboard</div>
              <div className="text-xs opacity-70 mt-1">M-Machine admin</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-cream/80 hover:text-gold">← Back to website</Link>
            <span className="text-cream/40">|</span>
            <Link href="/dashboard/login" className="text-cream/80 hover:text-gold">Sign out</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex gap-1 flex-wrap mb-6 bg-white rounded-lg p-1 border border-racing/10">
          <Link href="/dashboard" className="px-4 py-2 rounded-md text-sm font-medium text-racing hover:bg-cream-dark">
            Overview
          </Link>
          <Link href="/dashboard/products" className="px-4 py-2 rounded-md text-sm font-medium text-racing hover:bg-cream-dark">
            Products
          </Link>
          <Link href="/dashboard/featured" className="px-4 py-2 rounded-md text-sm font-medium text-racing hover:bg-cream-dark">
            Featured work
          </Link>
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
