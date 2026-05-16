import Link from "next/link";
import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { countNewQuoteRequests } from "@/lib/quotes";
import DashboardNav from "./DashboardNav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

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
        <DashboardNav initialNewRequestCount={newRequestCount} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
