import Link from "next/link";
import { featuredWork } from "@/lib/featured-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Featured custom work — fabrication, machining & restoration",
  description: "Showcase of bespoke fabrication, one-off engineering and restoration projects from the M-Machine workshop.",
};

export default function FeaturedPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <Link href="/" className="text-sm text-ink-muted hover:text-racing">← Home</Link>
        <h1 className="font-display text-4xl text-racing mt-2 mb-2">Featured workshop jobs</h1>
        <p className="text-ink-muted max-w-2xl">
          A showcase of the one-off fabrication, machining and restoration work
          that passes through the workshop. If you need something bespoke,
          these show what we&apos;re capable of.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {featuredWork.map((job) => (
          <article key={job.id} className="card bg-white">
            <div className="aspect-[16/10] bg-cream-dark rounded-lg mb-5 flex items-center justify-center">
              <svg width="80" height="80" viewBox="0 0 60 60" fill="none" stroke="#B8860B" strokeWidth="1.5">
                <path d="M10 40 L30 15 L50 40 Z" />
                <circle cx="30" cy="32" r="3" />
              </svg>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="chip !bg-racing !text-cream !text-[10px]">{job.tag.toUpperCase()}</span>
              <span className="text-xs text-ink-muted">{job.year}</span>
              <span className="text-xs text-ink-muted">·</span>
              <span className="text-xs text-ink-muted">{job.category}</span>
            </div>
            <h2 className="font-display text-xl text-racing mb-2">{job.title}</h2>
            <p className="text-sm text-ink-muted leading-relaxed mb-3">{job.description}</p>
            <details className="text-sm">
              <summary className="cursor-pointer text-racing font-medium hover:text-gold">Read the full story</summary>
              <p className="mt-2 text-ink-muted leading-relaxed">{job.fullStory}</p>
            </details>
          </article>
        ))}
      </div>

      <section className="bg-racing text-cream rounded-2xl p-10 text-center">
        <h2 className="font-display text-2xl mb-3">Got a project in mind?</h2>
        <p className="opacity-80 mb-6 max-w-2xl mx-auto">
          We love taking on unusual jobs. Send us a drawing, a photo, or just describe what you need —
          one of our engineers will come back to you with a quote.
        </p>
        <Link href="/contact" className="btn-gold">
          Start a bespoke enquiry →
        </Link>
      </section>
    </div>
  );
}
