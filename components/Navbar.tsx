"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import BrandMark from "@/components/BrandMark";

const links = [
  { href: "/", label: "Home" },
  { href: "/catalogue/mini", label: "Mini panels" },
  { href: "/catalogue/metals", label: "Metals" },
  { href: "/featured", label: "Featured work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-racing text-cream sticky top-0 z-50 border-b border-racing-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark priority className="h-11 w-11" />
            <div className="leading-tight">
              <div className="font-display text-lg">M-Machine</div>
              <div className="text-xs opacity-70 -mt-1">Est. 1980</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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

          <div className="hidden md:flex items-center gap-2">
            <Link href="/dashboard/login" className="text-xs text-cream/70 hover:text-gold">
              Owner login
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded hover:bg-racing-light"
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-3 space-y-1">
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
            <Link href="/dashboard/login" onClick={() => setOpen(false)} className="block px-3 py-2 text-xs text-cream/70">
              Owner login
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
