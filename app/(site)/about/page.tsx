import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About M-Machine and M-Machine-Metals",
  description:
    "Our story at M-Machine, from Classic Mini exports and pressed steel panels to engineering metals and precision engineered components in Darlington.",
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: {
    title: "About M-Machine | M-Machine",
    description:
      "Our family-run Classic Mini panel, engineering metal and fabrication workshop in Darlington.",
    url: absoluteUrl("/about"),
    type: "website",
  },
};

const milestones = [
  {
    year: "1978",
    title: "Protection, preparation and Minis",
    body:
      "We began by wax-oiling new cars for long-term protection against northern British winters. As British Leyland Minis became a major export, especially to Japan, we moved into preparing fully reconditioned used Minis.",
  },
  {
    year: "1980s",
    title: "A growing Mini export business",
    body:
      "Through the 1980s our Mini export work grew quickly. At one stage we held more than 600 Minis for direct export to Japan and worked from many thousands of square feet of factory space.",
  },
  {
    year: "1990s",
    title: "From cars to components",
    body:
      "When the Japanese Yen fell sharply against the Pound, we adapted. We started producing raw components ourselves and selling aftermarket Mini spares into the UK and European markets.",
  },
  {
    year: "1994",
    title: "Modern premises and manufacturing",
    body:
      "We started with boot board brackets, then grew the range to more than 860 individual items. We invested heavily in plant and machinery and moved into the premises where we still manufacture panels and parts today.",
  },
  {
    year: "Today",
    title: "Three connected services",
    body:
      "Today we bring together Classic Mini panels and parts, engineering metals, and precision engineered components from our Darlington workshop.",
  },
];

const services = [
  {
    title: "Mini panels and parts",
    body:
      "We make and supply pressed steel repair panels and catalogue parts for Classic Mini restorers, workshops and specialists.",
    href: "/parts/classic-mini-panels",
  },
  {
    title: "Metals",
    body:
      "We supply engineering metal stock to the public, fabricators and small businesses, strengthened by our purchase of MCM Metals.",
    href: "/parts/engineering-metals",
  },
  {
    title: "Precision engineering",
    body:
      "We produce press tooling, CNC machining, laser cutting and CNC press brake work for demanding industrial customers.",
    href: "/featured",
  },
];

export default function AboutPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ]);

  const aboutPage = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About M-Machine and M-Machine-Metals",
    description: metadata.description,
    url: absoluteUrl("/about"),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(aboutPage)} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <span>About</span>
      </nav>

      <header className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-end mb-8">
        <div>
          <p className="text-xs tracking-[3px] font-semibold text-gold mb-4">
            DARLINGTON WORKSHOP - EST. 1980
          </p>
          <h1 className="font-display text-4xl sm:text-5xl text-racing leading-tight mb-5">
            About M-Machine and M-Machine-Metals
          </h1>
          <p className="text-lg text-ink-muted leading-relaxed max-w-3xl">
            We are M-Machine, the trading name of Craftgrange Limited. From our workshop in
            Darlington, we supply Classic Mini pressed steel panels, engineering metals and precision
            engineered components to restorers, workshops, fabricators, businesses and the general
            public.
          </p>
        </div>

        <aside className="rounded-xl bg-cream-dark border-l-4 border-gold p-6">
          <p className="text-xs tracking-wider text-ink-muted font-semibold mb-3">COMPANY DETAILS</p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted">Registered company</dt>
              <dd className="font-semibold text-racing">Craftgrange Limited</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Company number</dt>
              <dd className="font-mono text-racing">01476185</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Location</dt>
              <dd className="text-racing">Unit 3-7 Forge Way, Cleveland Trading Estate, Darlington, DL1 2PJ</dd>
            </div>
          </dl>
        </aside>
      </header>

      <figure className="mb-12 overflow-hidden rounded-2xl bg-racing shadow-sm">
        <Image
          src="/about/mini-outside-factory.jpg"
          alt="Classic Minis at the M-Machine workshop during the early export years"
          width={1366}
          height={300}
          priority
          className="h-auto w-full object-cover"
        />
        <figcaption className="px-5 py-3 text-sm text-cream/80">
          Some of the Minis from our early years, when preparation and export work shaped the workshop we became.
        </figcaption>
      </figure>

      <section className="mb-12">
        <div className="grid md:grid-cols-3 gap-4">
          {services.map((service) => (
            <Link key={service.title} href={service.href} className="card bg-white block group">
              <h2 className="font-display text-xl text-racing mb-2">{service.title}</h2>
              <p className="text-sm text-ink-muted leading-relaxed mb-4">{service.body}</p>
              <span className="text-sm font-semibold text-racing group-hover:text-gold">
                View this area
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.75fr_1.25fr] gap-8 mb-12">
        <div className="lg:flex lg:flex-col">
          <p className="text-xs tracking-[3px] font-semibold text-gold mb-3">OUR HISTORY</p>
          <h2 className="font-display text-3xl text-racing mb-4">
            From Mini exports to manufacturing
          </h2>
          <p className="text-ink-muted leading-relaxed">
            We have changed shape over more than four decades, but the practical thread has stayed
            the same: understand the job, make or source the right part, and keep real stock close
            enough to answer the customer properly.
          </p>

          <div className="mt-8 lg:my-auto rounded-2xl bg-racing text-cream p-7 text-center shadow-sm">
            <p className="text-xs tracking-[3px] font-semibold text-gold mb-5">
              BUILT FROM REAL WORKSHOP KNOWLEDGE
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="font-display text-3xl text-gold">600+</div>
                <p className="text-xs opacity-80">Minis held for export</p>
              </div>
              <div>
                <div className="font-display text-3xl text-gold">860+</div>
                <p className="text-xs opacity-80">Mini parts developed</p>
              </div>
              <div>
                <div className="font-display text-3xl text-gold">3</div>
                <p className="text-xs opacity-80">Workshop services</p>
              </div>
            </div>
            <p className="mt-5 text-sm opacity-85 leading-relaxed">
              We still prefer practical answers, proper stock and a real conversation over guesswork.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {milestones.map((milestone) => (
            <article key={milestone.year} className="rounded-xl bg-white border border-racing/10 p-5">
              <div className="flex gap-4">
                <div className="shrink-0 w-20">
                  <span className="font-display text-2xl text-gold">{milestone.year}</span>
                </div>
                <div>
                  <h3 className="font-display text-xl text-racing mb-2">{milestone.title}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{milestone.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6 mb-12">
        <article className="rounded-xl bg-cream-dark p-6">
          <h2 className="font-display text-2xl text-racing mb-3">Engineering and metals</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">
            Our metals side grew naturally from the panel business. Making press tools and refining
            panel fit meant holding material stock and keeping tooling work in house. Adding MCM
            Metals gave us enough stock to serve customers beyond our own production work.
          </p>
          <Link href="/parts/engineering-metals" className="text-sm font-semibold text-racing hover:text-gold">
            Browse engineering metals
          </Link>
        </article>

        <article className="rounded-xl bg-cream-dark p-6">
          <h2 className="font-display text-2xl text-racing mb-3">How orders work</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">
            We still confirm orders personally. We do not take payment online: availability,
            carriage and invoice details are checked by phone or email before payment is arranged.
          </p>
          <Link href="/contact" className="text-sm font-semibold text-racing hover:text-gold">
            Ask a question
          </Link>
        </article>
      </section>

      <section className="bg-racing text-cream rounded-2xl p-8 md:p-10">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <p className="opacity-80 text-sm mb-3">VISIT OR CONTACT M-MACHINE</p>
            <h2 className="font-display text-3xl mb-3">Need advice on a panel, metal or engineered part?</h2>
            <p className="opacity-85 text-sm leading-relaxed max-w-2xl">
              Call our metals and engineering line on 01325 381302, or our Mini pressings and
              accounts line on 01325 381300. Our reception door is listed on what3words as
              recent.guards.cover.
            </p>
          </div>
          <div className="flex flex-wrap md:flex-col gap-3">
            <Link href="/contact" className="btn-gold">
              Get in touch
            </Link>
            <a
              href="https://w3w.co/recent.guards.cover"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-cream/40 px-5 py-3 text-sm font-semibold text-cream hover:bg-cream hover:text-racing"
            >
              Find us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
