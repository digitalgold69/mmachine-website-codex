import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import WeightCalculatorClient from "./WeightCalculatorClient";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Metal Weight Calculator",
  description: "Estimate the approximate weight of round, square, rectangular, sheet, tube, box and angle metal sections.",
  alternates: { canonical: absoluteUrl("/metals/weight-calculator") },
};

export default function MetalWeightCalculatorPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Metals catalogue", path: "/catalogue/metals" },
    { name: "Weight calculator", path: "/metals/weight-calculator" },
  ]);

  return (
    <div className="bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:text-racing">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/catalogue/metals" className="hover:text-racing">Metals catalogue</Link>
          <span className="mx-2">/</span>
          <span>Weight calculator</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[3px] text-gold">
              METALS INFORMATION
            </p>
            <h1 className="font-display text-4xl leading-tight text-racing sm:text-5xl">
              Metal Weight Calculator
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
              Estimate the approximate weight of common metal sections to help with carriage and handling checks.
              Results are a guide only because physical stock dimensions and material density can vary.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/catalogue/metals" className="btn-secondary">
                Back to metals catalogue
              </Link>
              <Link href="/contact" className="btn-secondary">
                Ask a question
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-racing/10 bg-racing shadow-sm">
            <Image
              src="/custom-engineering/metal-stock.jpg"
              alt="Metal stock stored in the M-Machine workshop"
              width={1600}
              height={1200}
              priority
              className="aspect-[4/3] h-auto w-full object-cover"
            />
          </div>
        </header>

        <section className="mt-10">
          <WeightCalculatorClient />
        </section>
      </div>
    </div>
  );
}
