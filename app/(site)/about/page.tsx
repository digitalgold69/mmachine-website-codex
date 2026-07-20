import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, openGraphImage } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About M-Machine | Mini Panels, Metals & Engineering",
  description:
    "Meet M-Machine in Darlington: Classic Mini panels, a huge engineering material range and practical custom engineering under one roof.",
  alternates: { canonical: absoluteUrl("/about") },
  openGraph: {
    title: "About M-Machine",
    description:
      "Classic Mini panels, engineering materials and custom engineering from our Darlington premises.",
    url: absoluteUrl("/about"),
    type: "website",
    images: openGraphImage("/custom-engineering/metal-stock.jpg", "Engineering material stock at M-Machine"),
  },
};

const services = [
  {
    number: "01",
    title: "Classic Mini panels",
    body: "Pressed steel panels and parts for Classic Minis, organised by section so you can find and order the right item quickly.",
    href: "/catalogue/mini",
    link: "Browse Mini panels",
  },
  {
    number: "02",
    title: "Engineering materials",
    body: "A wide stock range covering aluminium, brass, bronze, copper, stainless steel, steel, plastics and specialist grades.",
    href: "/catalogue/metals",
    link: "Browse materials",
  },
  {
    number: "03",
    title: "Custom engineering",
    body: "Cutting, folding, CNC machining, press work and fabrication for one-offs, replacement parts and small production runs.",
    href: "/custom-engineering",
    link: "Start a custom quote",
  },
];

const capabilities = [
  "CNC machining",
  "CNC press brake folding",
  "Sheet and section cutting",
  "Press tooling and pressed components",
  "Welding and fabrication",
  "One-off and small-batch work",
];

export default function AboutPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ]);

  const aboutPage = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About M-Machine",
    description: metadata.description,
    url: absoluteUrl("/about"),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(aboutPage)} />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-7 text-sm text-ink-muted">
          <Link href="/" className="hover:text-racing">Home</Link>
          <span className="mx-2">/</span>
          <span>About</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="mb-4 text-xs font-semibold tracking-[3px] text-gold">
              MADE AND SUPPLIED FROM DARLINGTON
            </p>
            <h1 className="mb-5 font-display text-4xl leading-tight text-racing sm:text-5xl">
              Mini panels, materials and engineering under one roof
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-ink-muted">
              We are M-Machine, the trading name of Craftgrange Limited. We supply Classic Mini
              panels, stock an extensive range of engineering materials, and make custom parts for
              individuals and businesses across the UK.
            </p>
          </div>

          <aside className="border-l-4 border-gold bg-cream-dark p-6">
            <p className="mb-3 text-xs font-semibold tracking-wider text-ink-muted">ESTABLISHED 1980</p>
            <p className="leading-7 text-racing">
              More than four decades of practical manufacturing and materials knowledge means you
              can speak to people who understand the part, the material and how it needs to be made.
            </p>
          </aside>
        </header>

        <figure className="my-12 overflow-hidden rounded-lg bg-racing">
          <Image
            src="/custom-engineering/metal-stock.jpg"
            alt="Engineering material stock at M-Machine in Darlington"
            width={1600}
            height={1200}
            priority
            className="aspect-[4/3] w-full object-cover sm:aspect-[2/1] lg:aspect-[16/7]"
          />
          <figcaption className="px-5 py-3 text-sm text-cream/85">
            Engineering material stock at our Darlington premises.
          </figcaption>
        </figure>

        <section aria-labelledby="what-we-do" className="py-4">
          <div className="mb-8 max-w-3xl">
            <p className="mb-3 text-xs font-semibold tracking-[3px] text-gold">WHAT WE DO</p>
            <h2 id="what-we-do" className="font-display text-3xl text-racing">
              Three straightforward ways we can help
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {services.map((service) => (
              <article key={service.number} className="card flex h-full flex-col bg-white">
                <span className="font-mono text-sm font-bold text-gold">{service.number}</span>
                <h3 className="mt-3 font-display text-2xl text-racing">{service.title}</h3>
                <p className="mt-3 flex-1 leading-7 text-ink-muted">{service.body}</p>
                <Link href={service.href} className="mt-6 font-semibold text-racing hover:text-gold">
                  {service.link} →
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="my-16 grid gap-10 border-y border-racing/10 py-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-[3px] text-gold">CURRENT CAPABILITIES</p>
            <h2 className="mb-4 font-display text-3xl text-racing">From material to finished part</h2>
            <p className="leading-7 text-ink-muted">
              Because material supply and engineering sit together, we can help choose the stock,
              cut it to size and carry out the work needed to produce the finished component.
              Customers can send a CAD file, drawing, photograph or clear description.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/custom-engineering" className="btn-primary">Request a custom quote</Link>
              <Link href="/featured" className="btn-secondary">View Featured Work</Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Engineering capabilities">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-center gap-3 border-b border-racing/10 py-3 font-semibold text-racing">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs text-white">✓</span>
                {capability}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-stretch">
          <div className="bg-racing p-8 text-cream md:p-10">
            <p className="mb-3 text-xs font-semibold tracking-[3px] text-gold">A PERSONAL SERVICE</p>
            <h2 className="mb-4 font-display text-3xl">Orders are checked by a real person</h2>
            <p className="max-w-2xl leading-7 text-cream/85">
              Send an order request online and we will confirm availability, carriage and payment
              details with you. For custom work, upload what you have and tell us what the finished
              part needs to do.
            </p>
            <Link href="/contact" className="btn-gold mt-6">Contact M-Machine</Link>
          </div>

          <aside className="bg-cream-dark p-8 md:p-10">
            <p className="mb-4 text-xs font-semibold tracking-[3px] text-gold">COMPANY DETAILS</p>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-ink-muted">Registered company</dt>
                <dd className="font-semibold text-racing">Craftgrange Limited</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Company number</dt>
                <dd className="font-mono text-racing">01476185</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Address</dt>
                <dd className="text-racing">Unit 6 Forge Way, Cleveland Trading Estate, Darlington, DL1 2PJ</dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
