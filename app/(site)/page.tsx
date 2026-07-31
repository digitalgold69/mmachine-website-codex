import Link from "next/link";
import Image from "next/image";
import {
  metalsCatalogueUrl,
  miniCatalogueUrl,
} from "@/lib/catalogue-versions";
import { products, sections } from "@/lib/mini-data";
import { metals } from "@/lib/metals-data";
import { featuredWork as fallbackFeaturedWork } from "@/lib/featured-data";
import { listFeaturedWork } from "@/lib/featured";
import FeaturedWorkGrid from "@/components/FeaturedWorkGrid";
import { guideUrl, guides } from "@/lib/articles";

export const dynamic = "force-dynamic";

const heroAvifSrcSet = [
  "/home/mmachine-services-hero-640.avif 640w",
  "/home/mmachine-services-hero-960.avif 960w",
  "/home/mmachine-services-hero-1280.avif 1280w",
].join(", ");
const heroWebpSrcSet = [
  "/home/mmachine-services-hero-640.webp 640w",
  "/home/mmachine-services-hero-960-v2.webp 960w",
  "/home/mmachine-services-hero-1280.webp 1280w",
].join(", ");
const heroJpegSrcSet = [
  "/home/mmachine-services-hero-640.jpg 640w",
  "/home/mmachine-services-hero-960.jpg 960w",
  "/home/mmachine-services-hero-1280.jpg 1280w",
].join(", ");
const transparentPixel =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export default async function HomePage() {
  let featuredWork = fallbackFeaturedWork;
  try {
    featuredWork = await listFeaturedWork();
  } catch {
    featuredWork = fallbackFeaturedWork;
  }

  const latestFeatured = featuredWork.slice(0, 6);
  const latestGuides = guides.slice(0, 6);
  const miniCount = products.length;
  const metalsCount = metals.length;
  const sectionCount = sections.length;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cream via-cream-dark to-cream" />
        <picture className="pointer-events-none absolute inset-0 lg:hidden" aria-hidden="true">
          <source media="(max-width: 1023px)" type="image/avif" srcSet={heroAvifSrcSet} sizes="100vw" />
          <source media="(max-width: 1023px)" type="image/webp" srcSet={heroWebpSrcSet} sizes="100vw" />
          <source media="(max-width: 1023px)" type="image/jpeg" srcSet={heroJpegSrcSet} sizes="100vw" />
          <img
            src={transparentPixel}
            alt=""
            width={1280}
            height={853}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center opacity-[0.08]"
          />
        </picture>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] xl:gap-14">
            <div className="max-w-2xl">
              <p className="text-xs tracking-[3px] font-semibold text-gold mb-4">
              CLASSIC MINI SPECIALISTS · EST. 1980
              </p>
              <h1 className="home-hero-title font-display font-semibold text-racing leading-[1.1] mb-6">
                Mini Panels, Custom Engineering,<br />{" "}
                <span className="text-gold">Extensive Material Range.</span>
              </h1>
              <p className="text-lg text-ink-muted leading-relaxed mb-8 max-w-xl">
                Four decades supplying restorers, workshops and fabricators from our Darlington workshop.
                Browse our current catalogues, then send an order request for availability, carriage and payment details.
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

            <picture className="relative hidden aspect-[3/2] w-full overflow-hidden lg:block">
              <source
                media="(min-width: 1024px)"
                type="image/avif"
                srcSet={heroAvifSrcSet}
                sizes="(min-width: 1280px) 590px, 48vw"
              />
              <source
                media="(min-width: 1024px)"
                type="image/webp"
                srcSet={heroWebpSrcSet}
                sizes="(min-width: 1280px) 590px, 48vw"
              />
              <source
                media="(min-width: 1024px)"
                type="image/jpeg"
                srcSet={heroJpegSrcSet}
                sizes="(min-width: 1280px) 590px, 48vw"
              />
              <img
                src={transparentPixel}
                alt="Classic Mini panels, precision machining and engineering metals at M-Machine"
                width={1280}
                height={853}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
            </picture>
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
                href={miniCatalogueUrl}
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
                <span className="text-xs font-mono text-gold">{metalsCount} CATALOGUE LINES</span>
              </div>
              <h3 className="font-display text-xl text-racing mb-2">Engineering metals</h3>
              <p className="text-sm text-ink-muted mb-4">
                Tool steels, stainless, aluminium, brass and specialist engineering materials,
                supplied in the sizes and units shown in our current catalogue.
              </p>
            </Link>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/catalogue/metals" className="text-sm font-medium text-racing hover:text-gold inline-flex items-center gap-1">
                Browse catalogue →
              </Link>
              <a
                href={metalsCatalogueUrl}
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

      {/* CUSTOM ENGINEERING */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-2xl bg-racing p-6 text-cream md:p-9">
          <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs tracking-[3px] font-semibold text-gold mb-3">
                CUSTOM ENGINEERING QUOTES
              </p>
              <h2 className="font-display text-3xl sm:text-4xl leading-tight mb-4">
                Upload a design. Get a quote. We make the part.
              </h2>
              <p className="text-sm leading-7 text-cream/85">
                Need a one-off bracket, folded panel, cut plate, machined part or finished fabrication?
                Send CAD files, a sketch or a photo. We quote it, make it, and send it to you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/custom-engineering" className="btn-gold">
                  Start a custom quote
                </Link>
                <Link
                  href="/catalogue/metals"
                  className="inline-flex items-center justify-center rounded-lg border border-cream/40 px-5 py-3 text-sm font-semibold text-cream hover:bg-cream hover:text-racing"
                >
                  View materials
                </Link>
              </div>
            </div>
            <div>
              <div className="overflow-hidden rounded-xl border border-cream/20">
                <Image
                  src="/custom-engineering/fabricated-frame.jpg"
                  alt="Custom fabricated metal frame in the M-Machine workshop"
                  width={1600}
                  height={1200}
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ["01", "Upload", "CAD file, sketch or photo"],
                  ["02", "Choose", "Material, finish and quantity"],
                  ["03", "Receive", "Finished part sent to you"],
                ].map(([number, title, body]) => (
                  <div key={number} className="rounded-xl bg-cream p-4 text-racing">
                    <div className="font-mono text-sm font-bold text-gold">{number}</div>
                    <h3 className="mt-2 font-display text-xl">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-cream-dark py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <h2 className="font-display text-3xl text-racing mb-2">Featured Work</h2>
              <p className="text-ink-muted">One-off fabrication, machining and restoration work.</p>
            </div>
            <Link href="/featured" className="text-sm font-medium text-racing hover:text-gold">
              View all Featured Work →
            </Link>
          </div>

          <FeaturedWorkGrid
            items={latestFeatured}
            emptyText="New Featured Work will appear here as it is added by M-Machine."
            gridClassName="grid md:grid-cols-3 gap-6"
            cardImageClassName="aspect-[4/3]"
            showCategory={false}
            showDescription={false}
          />
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
            <div className="text-sm text-ink-muted">Mini panels in catalogue</div>
          </div>
          <div>
            <div className="font-display text-4xl text-gold mb-2">{metalsCount.toLocaleString("en-GB")}</div>
            <div className="text-sm text-ink-muted">Metal catalogue lines</div>
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
          <Link href="/custom-engineering" className="btn-gold">
            Start a custom quote →
          </Link>
        </div>
      </section>

      {/* ENGINEERING GUIDES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[3px] text-gold">FROM THE WORKSHOP</p>
            <h2 className="font-display text-3xl text-racing mb-2">Engineering guides</h2>
            <p className="text-ink-muted">Practical guidance on custom engineering, materials, machining and workshop processes.</p>
          </div>
          <Link href="/articles" className="text-sm font-semibold text-racing hover:text-gold">
            View all guides <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latestGuides.map((guide) => (
            <article key={guide.id} className="card flex h-full flex-col bg-white">
              <Link href={guideUrl(guide)} className="group flex h-full flex-col">
                <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-lg bg-cream-dark">
                  <Image
                    src={guide.image}
                    alt={guide.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">{guide.category}</p>
                <h3 className="font-display text-xl leading-snug text-racing group-hover:text-gold">{guide.shortTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{guide.description}</p>
                <span className="mt-auto pt-4 text-sm font-semibold text-racing group-hover:text-gold">
                  Read guide <span aria-hidden="true">&rarr;</span>
                </span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
