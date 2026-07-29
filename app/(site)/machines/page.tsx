import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, openGraphImage } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Vehicles and Machine Types",
  description: "Browse M-Machine parts by vehicle and machine type, including Classic Mini body panels and restoration pressings.",
  alternates: { canonical: absoluteUrl("/machines") },
  openGraph: {
    title: "Vehicles and Machine Types | M-Machine",
    description: "Browse M-Machine parts by vehicle and machine type.",
    url: absoluteUrl("/machines"),
    type: "website",
    images: openGraphImage("/about/mini-outside-factory.jpg", "Classic Mini at M-Machine"),
  },
};

export default function MachinesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link> / Machines
      </nav>
      <h1 className="font-display text-4xl text-racing">Vehicles and machine types</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Find parts by the vehicle they are designed for. Each page links directly to relevant catalogue
        categories and individual parts.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/machines/classic-mini" className="card block">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Vehicle</p>
          <h2 className="mt-2 font-display text-2xl text-racing">Classic Mini</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Pressed steel panels and restoration parts for Mini saloons, Clubman, Traveller, Van and Pick-Up.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-racing">Browse Classic Mini panels &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
