import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import CustomEngineeringForm from "./CustomEngineeringForm";
import ScrollToQuoteButton from "./ScrollToQuoteButton";
import { customCapabilities, customSteps } from "@/lib/custom-engineering-content";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Upload a Design for Custom Metal Parts",
  description:
    "Upload a CAD file, drawing, sketch or photo for custom cutting, folding, CNC machining and fabrication from M-Machine in Darlington.",
  alternates: { canonical: absoluteUrl("/custom-engineering") },
  openGraph: {
    title: "Upload a Design for Custom Metal Parts | M-Machine",
    description:
      "Send CAD files, drawings, sketches or photos for cutting, folding, CNC machining and fabrication in our Darlington workshop.",
    url: absoluteUrl("/custom-engineering"),
    type: "website",
    images: [absoluteUrl("/custom-engineering/custom-fabrication-cam.jpg")],
  },
};

export default function CustomEngineeringPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Custom engineering", path: "/custom-engineering" },
  ]);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Custom metal cutting, machining and fabrication quotes",
    provider: {
      "@type": "LocalBusiness",
      name: "M-Machine",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Unit 6 Forge Way, Cleveland Trading Estate",
        addressLocality: "Darlington",
        postalCode: "DL1 2PJ",
        addressCountry: "GB",
      },
      telephone: "+44 1325 381302",
    },
    areaServed: "United Kingdom",
    serviceType: [
      "Custom metal cutting",
      "CNC machining",
      "Folding and bending",
      "Threading and countersinking",
      "Welding and assembly",
      "Fabricated components",
    ],
    url: absoluteUrl("/custom-engineering"),
  };

  return (
    <div className="bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(serviceJsonLd)} />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:text-racing">Home</Link>
          <span className="mx-2">/</span>
          <span>Custom engineering</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[3px] text-gold">
              CUSTOM WORKSHOP QUOTES
            </p>
            <h1 className="font-display text-4xl leading-tight text-racing sm:text-5xl">
              Upload the design. We make the part.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
              Send a CAD file, drawing, sketch, photo or written description. We cut, fold,
              machine and fabricate custom parts in our Darlington workshop.
            </p>
            <div className="mt-6">
              <ScrollToQuoteButton className="btn-primary">
                Start a custom quote
              </ScrollToQuoteButton>
            </div>
          </div>

          <aside className="rounded-2xl border border-racing/10 bg-white p-5 shadow-sm">
            <div className="overflow-hidden rounded-xl bg-racing">
              <Image
                src="/custom-engineering/custom-fabrication-cam.jpg"
                alt="Custom machined cam part made from a technical drawing"
                width={1600}
                height={1200}
                priority
                className="aspect-[4/3] h-auto w-full object-cover"
              />
            </div>
            <p className="mt-4 text-center text-sm font-semibold text-racing">
              CAD files, drawings, sketches, photos and written descriptions accepted.
            </p>
          </aside>
        </header>

        <section className="mt-12">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
                OUR CAPABILITIES
              </p>
              <h2 className="font-display text-3xl text-racing">From drawing to finished part</h2>
            </div>
            <Link href="/custom-engineering/guide" className="text-sm font-semibold text-racing underline decoration-gold underline-offset-4 hover:text-gold">
              Explore our custom engineering guide
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {customCapabilities.map((item) => (
              <article key={item.title} className="rounded-xl border border-racing/10 bg-white p-5">
                <h3 className="font-display text-xl text-racing">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {customSteps.map((step) => (
            <article key={step.number} className="rounded-xl border border-racing/10 bg-white p-5">
              <div className="font-mono text-sm font-bold text-gold">{step.number}</div>
              <h2 className="mt-3 font-display text-xl text-racing">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{step.body}</p>
            </article>
          ))}
        </section>

        <section id="quote-form" className="mt-12 scroll-mt-28">
          <div className="mb-6 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              START THE JOB
            </p>
            <h2 className="font-display text-3xl text-racing">Tell us what you need</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              Add a file if you have one, describe the job, then leave your contact details so
              we can prepare the quote.
            </p>
          </div>
          <CustomEngineeringForm />
        </section>

        <section className="mt-12 rounded-2xl border border-racing/10 bg-white p-7 md:p-9">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
                NEED MORE INFORMATION?
              </p>
              <h2 className="font-display text-3xl text-racing">Read our custom engineering guide</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
                See the files we accept, workshop capabilities, materials, examples and answers
                to common questions before starting your quote.
              </p>
            </div>
            <Link href="/custom-engineering/guide" className="btn-secondary justify-center">
              View the guide
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
