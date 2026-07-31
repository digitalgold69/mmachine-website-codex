import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, loginUrlFor } from "@/lib/auth";
import { countNewQuoteRequests } from "@/lib/quotes";
import DashboardNav from "./DashboardNav";
import DashboardLiveUpdates from "./DashboardLiveUpdates";
import BrandMark from "@/components/BrandMark";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const headerStore = await headers();
  const requestedPath = headerStore.get("x-mmachine-pathname") || "/dashboard";

  if (!user) redirect(loginUrlFor(requestedPath));
  if (user.mustChangePassword && !requestedPath.startsWith("/dashboard/account/security")) {
    redirect("/dashboard/account/security?required=1");
  }

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
            <BrandMark className="h-10 w-10" />
            <div className="min-w-0">
              <div className="font-display text-lg leading-none">Owner dashboard</div>
              <div className="text-xs opacity-70 mt-1">M-Machine admin</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <Link href="/" className="text-cream/80 hover:text-gold">Back to website</Link>
            <span className="text-cream/40">|</span>
            <Link href="/dashboard/account/security" className="text-cream/80 hover:text-gold">
              Account
            </Link>
            <span className="text-cream/40">|</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DashboardNav initialNewRequestCount={newRequestCount} userRole={user.role} />
        <DashboardLiveUpdates />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
