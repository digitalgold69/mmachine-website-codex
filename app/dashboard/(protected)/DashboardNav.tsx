"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardNav({ initialNewRequestCount }: { initialNewRequestCount: number }) {
  const [newRequestCount, setNewRequestCount] = useState(initialNewRequestCount);

  useEffect(() => {
    function handleViewed() {
      setNewRequestCount((count) => Math.max(0, count - 1));
    }

    window.addEventListener("mmachine:new-quote-viewed", handleViewed);
    return () => window.removeEventListener("mmachine:new-quote-viewed", handleViewed);
  }, []);

  return (
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
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold leading-none text-cream"
          >
            {newRequestCount > 99 ? "99+" : newRequestCount}
          </span>
        )}
      </Link>
      <Link href="/dashboard/featured" className="inline-flex min-w-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-racing hover:bg-cream-dark sm:px-4">
        Featured work
      </Link>
    </nav>
  );
}
