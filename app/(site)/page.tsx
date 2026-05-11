import Link from "next/link";
import { products, sections } from "@/lib/mini-data";
import { metals } from "@/lib/metals-data";
import { featuredWork } from "@/lib/featured-data";

export default function HomePage() {
  const latestFeatured = featuredWork.slice(0, 3);
  const miniCount = products.length;
  const metalsCount = metals.length;
  const sectionCount = sections.length;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cream via-cream-dark to-cream pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none opacity-20 hidden md:block">
          <svg viewBox="0 0 600 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <g stroke="#0F3D2E" strokeWidth="1.5" fill="none">
              <path d="M80 300 L80 220 Q80 180 120 180 L200 180 L240 120 L420 120 L460 180 L540 180 Q580 180 580 220 L580 300 Z" />
              <circle cx="170" cy="300" r="45" />
              <circle cx="490" cy="300" r="45" />
              <path d="M240 180 L240 220 L420 220 L420 180" />
              <path d="M260 140 L400 140" />
            </g>
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[3px] font-semibold text-gold mb-4">
              CLASSIC MINI SPECIALISTS · EST. 1980
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-racing leading-[1.1] mb-6">
              Pressed panels, engineered parts,<br />
              <span className="text-gold">built to last.</span>
            </h1>
            <p className="text-lg text-ink-muted leading-relaxed mb-8 max-w-xl">
              Four decades supplying restorers, workshops and fabricators from our Darlington workshop.
              Every panel listed is stocked on the shelf — not drop-shipped.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalogue/mini" className="btn-primary">
                Browse {miniCount} Mini panels
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </Link>
              <Link href="/catalogue/metals" className="btn-secondary">
                View metals
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CATALOGUES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h2 className="font-display text-3xl text-racing mb-2">Our catalogues</h2>
          <p className="text-ink-muted">Browse online with our interactive 3D Mini, or download the full PDF.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card group block">
            <Link href="/catalogue/mini" className="block">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-cream-dark flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F3D2E" strokeWidth="1.5">
                    <path d="M3 12h2l2-5h10l2 5h2v6h-3a2 2 0 01-4 0H10a2 2 0 01-4 0H3v-6z" />
                    <circle cx="8" cy="17" r="1.5" />
                    <circle cx="16" cy="17" r="1.5" />
                  </svg>
                </div>
                <span className="text-xs font-mono text-gold">{miniCount} PARTS</span>
              </div>
              <h3 className="font-display text-xl text-racing mb-2">Classic Mini panels</h3>
              <p className="text-sm text-ink-muted mb-4">
                Wings, floor pans, sills, A-panels, boot floors. Steel pressings for Mk1 through Mk5,
                Cooper, Elf, Hornet, Clubman, Traveller, Van and Pick-Up. Organised across {sectionCount} sections
                with an interactive 3D Mini to find exactly what you need.
              </p>
            </Link>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/catalogue/mini" className="text-sm font-medium text-racing hover:text-gold inline-flex items-center gap-1">
                Browse catalogue →
              </Link>
              <a
                href="/catalogue/mini-catalogue.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-racing hover:text-gold inline-flex items-center gap-1"
              >
                Download PDF ↓
              </a>
            </div>
          </div>

          <div className="card group block">
            <Link href="/catalogue/metals" className="block">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-cream-dark flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F3D2E" strokeWidth="1.5">
                    <rect x="3" y="8" width="18" height="8" rx="1" />
                    <path d="M3 12h18M8 8v8M16 8v8" />
                  </svg>
                </div>
                <span className="text-xs font-mono text-gold">{metalsCount} GRADES</span>
              </div>
              <h3 className="font-display text-xl text-racing mb-2">Engineering metals</h3>
              <p className="text-sm text-ink-muted mb-4">
                Tool steels, stainless, aluminium, brass. Cut to size from stock. Same-day despatch
                on orders placed before noon.
              </p>
            </Link>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/catalogue/metals" className="text-sm font-medium text-racing hover:text-gold inline-flex items-center gap-1">
                Browse catalogue →
              </Link>
              <a
                href="/catalogue/metals-catalogue.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-racing hover:text-gold inline-flex items-center gap-1"
              >
                Download PDF ↓
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-cream-dark py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <h2 className="font-display text-3xl text-racing mb-2">Featured workshop jobs</h2>
              <p className="text-ink-muted">One-off fabrication, machining and restoration work.</p>
            </div>
            <Link href="/featured" className="text-sm font-medium text-racing hover:text-gold">
              View all featured work →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {latestFeatured.map((job) => (
              <article key={job.id} className="card bg-white flex flex-col">
                <div className="aspect-[4/3] bg-cream-dark rounded-lg mb-4 overflow-hidden flex items-center justify-center">
                  {job.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.imagePath} alt={job.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="#B8860B" strokeWidth="1.5">
                      <path d="M10 40 L30 15 L50 40 Z" />
                      <circle cx="30" cy="32" r="3" />
                    </svg>
                  )}
                </div>
                <p className="text-xs tracking-wider text-gold font-semibold mb-1">
                  {job.tag.toUpperCase()} · {job.year}
                </p>
                <h3 className="font-display text-lg text-racing mb-2">{job.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{job.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="font-display text-4xl text-gold mb-2">45+</div>
            <div className="text-sm text-ink-muted">Years trading</div>
          </div>
          <div>
            <div className="font-display text-4xl text-gold mb-2">{miniCount}</div>
            <div className="text-sm text-ink-muted">Mini parts in catalogue</div>
          </div>
          <div>
            <div className="font-display text-4xl text-gold mb-2">900+</div>
            <div className="text-sm text-ink-muted">Metal grades</div>
          </div>
          <div>
            <div className="font-display text-4xl text-gold mb-2">UK</div>
            <div className="text-sm text-ink-muted">Workshop &amp; dispatch</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-racing text-cream py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="font-display text-3xl mb-4">Need something special?</h2>
          <p className="opacity-80 mb-6 max-w-2xl mx-auto">
            We take on bespoke fabrication, restoration machining and one-off custom jobs.
            Tell us what you need and one of our engineers will get back to you.
          </p>
          <Link href="/contact" className="btn-gold">
            Get in touch →
          </Link>
        </div>
      </section>
    </>
  );
}
