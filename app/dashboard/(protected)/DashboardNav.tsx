"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function DashboardNav({
  initialNewRequestCount,
  userRole,
}: {
  initialNewRequestCount: number;
  userRole: "admin" | "member";
}) {
  const [newRequestCount, setNewRequestCount] = useState(initialNewRequestCount);
  const pathname = usePathname();

  useEffect(() => {
    function handleViewed() {
      setNewRequestCount((count) => Math.max(0, count - 1));
    }

    window.addEventListener("mmachine:new-quote-viewed", handleViewed);
    return () => window.removeEventListener("mmachine:new-quote-viewed", handleViewed);
  }, []);

  function linkClass(href: string) {
    const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
    return [
      "inline-flex min-w-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium sm:px-4",
      active
        ? "bg-gold text-cream shadow-sm hover:bg-gold-light"
        : "text-racing hover:bg-cream-dark",
    ].join(" ");
  }
  const ordersActive = pathname.startsWith("/dashboard/orders");

  return (
    <nav className="grid grid-cols-2 gap-1 mb-6 overflow-hidden rounded-lg border border-racing/10 bg-white p-1 sm:flex sm:flex-wrap">
      <Link href="/dashboard" className={linkClass("/dashboard")}>
        Overview
      </Link>
      <Link href="/dashboard/products" className={linkClass("/dashboard/products")}>
        Products
      </Link>
      <Link href="/dashboard/orders" className={`${linkClass("/dashboard/orders")} gap-2`}>
        <span className="truncate">Quote requests</span>
        {newRequestCount > 0 && (
          <span
            aria-label={`${newRequestCount} new quote requests`}
            className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
              ordersActive ? "bg-cream text-gold" : "bg-gold text-cream"
            }`}
          >
            {newRequestCount > 99 ? "99+" : newRequestCount}
          </span>
        )}
      </Link>
      <Link href="/dashboard/featured" className={linkClass("/dashboard/featured")}>
        Featured Work
      </Link>
      {userRole === "admin" && (
        <Link href="/dashboard/team" className={linkClass("/dashboard/team")}>
          Team
        </Link>
      )}
    </nav>
  );
}
