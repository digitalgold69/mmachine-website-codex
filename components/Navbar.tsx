"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "@/components/BrandMark";

const links = [
  { href: "/", label: "Home" },
  { href: "/catalogue/mini", label: "Mini panels" },
  { href: "/catalogue/metals", label: "Metals" },
  { href: "/custom-engineering", label: "Custom work" },
  { href: "/featured", label: "Featured Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b border-racing-dark bg-racing text-cream shadow-[0_5px_16px_rgba(0,0,0,0.22)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="header-content-shadow flex min-h-[92px] items-center justify-between py-3 lg:min-h-[100px]">
          <Link href="/" className="flex items-center gap-4 sm:gap-5">
            <BrandMark priority className="h-[58px] w-[58px] sm:h-[64px] sm:w-[64px]" />
            <div className="leading-tight">
              <div className="font-logo text-3xl text-white">M-Machine</div>
              <div className="mt-0.5 text-sm font-medium text-cream/80">Est. 1980</div>
            </div>
          </Link>

          <div className="hidden xl:flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                    active
                      ? "bg-gold text-cream"
                      : "text-cream hover:bg-racing-light"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-6 hidden min-w-[205px] flex-col items-end gap-3 border-l border-cream/15 pl-5 text-right text-xs leading-snug text-cream/80 xl:flex">
            <a href="tel:01325381302" className="hover:text-gold">
              <span className="block font-semibold text-cream">Metals &amp; Engineering</span>
              <span className="font-mono">01325 381302</span>
            </a>
            <a href="tel:01325381300" className="hover:text-gold">
              <span className="block font-semibold text-cream">Mini Pressings &amp; Accounts</span>
              <span className="font-mono">01325 381300</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="xl:hidden p-3 rounded hover:bg-racing-light"
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {open && (
          <div id="mobile-navigation" className="header-content-shadow xl:hidden pb-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-racing-light"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 space-y-2 border-t border-cream/15 px-3 pt-3 text-sm">
              <a href="tel:01325381302" className="block text-cream/85 hover:text-gold">
                <span className="block text-xs uppercase tracking-wide text-cream/60">Metals &amp; Engineering</span>
                <span className="font-mono">01325 381302</span>
              </a>
              <a href="tel:01325381300" className="block text-cream/85 hover:text-gold">
                <span className="block text-xs uppercase tracking-wide text-cream/60">Mini Pressings &amp; Accounts</span>
                <span className="font-mono">01325 381300</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
