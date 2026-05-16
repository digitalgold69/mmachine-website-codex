import Link from "next/link";
import type { Metadata } from "next";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About M-Machine and M-Machine-Metals",
  description:
    "The history of M-Machine, from Classic Mini exports and pressed steel panels to engineering metals and precision engineered components in Darlington.",
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: {
    title: "About M-Machine | M-Machine",
    description:
      "Family-run Classic Mini panel, engineering metal and fabrication specialists based in Darlington since 1980.",
    url: absoluteUrl("/about"),
    type: "website",
  },
};

const milestones = [
  {
    year: "1978",
    title: "Protection, preparation and Minis",
    body:
      "The business began by wax-oiling new cars for long-term protection against northern British winters. As British Leyland Minis became a major export, especially to Japan, the company shifted towards preparing fully reconditioned used Minis.",
  },
  {
    year: "1980s",
    title: "A growing Mini export business",
    body:
      "During the 1980s the Mini side of the business grew strongly, at one stage holding more than 600 Minis for direct export to Japan and operating from many thousands of square feet of factory space.",
  },
  {
    year: "1990s",
    title: "From cars to components",
    body:
      "When the Japanese Yen fell sharply against the Pound, the business adapted by producing raw components in house and selling aftermarket Mini spares into the UK and European markets.",
  },
  {
    year: "1994",
    title: "Modern premises and manufacturing",
    body:
      "Starting with boot board brackets, the range grew to more than 860 individual items, supported by major investment in plant and machinery and a move to the premises where panels and parts are still manufactured.",
  },
  {
    year: "Today",
    title: "Three connected services",
    body:
      "M-Machine now brings together Classic Mini panels and parts, engineering metals, and precision engineered components from its Darlington workshop.",
  },
];

const services = [
  {
    title: "Mini panels and parts",
    body:
      "Pressed steel repair panels and catalogue parts for Classic Mini restorers, workshops and specialists.",
    href: "/parts/classic-mini-panels",
  },
  {
    title: "Metals",
    body:
      "Engineering metal stock for the public, fabricators and small businesses, strengthened by the purchase of MCM Metals.",
    href: "/parts/engineering-metals",
  },
  {
    title: "Precision engineering",
    body:
      "Press tooling, CNC machining, laser cutting and CNC press brake work supporting sectors including rail and deep ocean industries.",
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

      <header className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-end mb-12">
        <div>
          <p className="text-xs tracking-[3px] font-semibold text-gold mb-4">
            DARLINGTON WORKSHOP - EST. 1980
          </p>
          <h1 className="font-display text-4xl sm:text-5xl text-racing leading-tight mb-5">
            About M-Machine and M-Machine-Metals
          </h1>
          <p className="text-lg text-ink-muted leading-relaxed max-w-3xl">
            M-Machine is the trading name of Craftgrange Limited, a small UK business based in
            Darlington. The company supplies Classic Mini pressed steel panels, engineering metals
            and precision engineered components to restorers, workshops, fabricators, businesses
            and the general public.
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
        <div>
          <p className="text-xs tracking-[3px] font-semibold text-gold mb-3">OUR HISTORY</p>
          <h2 className="font-display text-3xl text-racing mb-4">
            From Mini exports to manufacturing
          </h2>
          <p className="text-ink-muted leading-relaxed">
            The business has changed shape over more than four decades, but the practical thread has
            stayed the same: understand the job, make or source the right part, and keep real stock
            close enough to answer the customer properly.
          </p>
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
            The metals side grew naturally from the panel business. Making press tools and refining
            panel fit meant holding material stock and keeping tooling work in house. The addition
            of MCM Metals gave M-Machine enough stock to serve customers beyond its own production
            work.
          </p>
          <Link href="/parts/engineering-metals" className="text-sm font-semibold text-racing hover:text-gold">
            Browse engineering metals
          </Link>
        </article>

        <article className="rounded-xl bg-cream-dark p-6">
          <h2 className="font-display text-2xl text-racing mb-3">How orders work</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">
            M-Machine still confirms orders personally. The team does not take payment online:
            availability, carriage and invoice details are checked by phone or email before payment
            is arranged.
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
              Call the metals and engineering line on 01325 381302, or the Mini pressings and
              accounts line on 01325 381300. The reception door is listed on what3words as
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
