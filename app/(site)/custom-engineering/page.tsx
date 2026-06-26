import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import CustomEngineeringForm from "./CustomEngineeringForm";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Custom Metal Cutting, Folding & Fabrication Quotes",
  description:
    "A UK workshop for SendCutSend-style custom parts: upload DXF, DWG, AI, EPS, STEP or STP files for cutting, folding, machining, finishing and fabrication quotes.",
  alternates: { canonical: absoluteUrl("/custom-engineering") },
  openGraph: {
    title: "Custom Metal Cutting & Fabrication Quotes | M-Machine",
    description:
      "Upload CAD files or describe a part for custom cutting, folding, machining and fabrication quotes from M-Machine in Darlington.",
    url: absoluteUrl("/custom-engineering"),
    type: "website",
    images: [absoluteUrl("/about/mini-outside-factory.jpg")],
  },
};

const materials = [
  "Aluminium",
  "Aluminium Bronze/Manganese Bronze",
  "Brass",
  "Cast Iron",
  "Copper",
  "Gauge Plate",
  "Nickel Silver",
  "Phosphor Bronze",
  "Leaded Gunmetal",
  "Plastics",
  "Stainless Steel",
  "Steel",
  "Silver steel",
  "Steel Tube",
];

const capabilities = [
  {
    title: "Cutting and profiling",
    body: "Flat patterns, plates, brackets, panels and blanks cut from the right material and thickness.",
  },
  {
    title: "Folds, bends and formed work",
    body: "Folded sheet metal, bent brackets and formed panels quoted from CAD files, drawings or clear dimensions.",
  },
  {
    title: "Holes, threads and inserts",
    body: "Tapping, countersinking, counterboring, hardware insertion and secondary operations included in one request.",
  },
  {
    title: "Finishing and assembly",
    body: "Deburring, powder coating, anodising, plating, welding or assembly where the job needs more than a raw cut part.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload files or describe the part",
    body: "Send a CAD file, drawing, photo, sketch or a clear description of what you need made.",
  },
  {
    number: "02",
    title: "Add material and finish notes",
    body: "Choose from M-Machine's stock materials, add thickness, quantity, folds, finishes and delivery details.",
  },
  {
    number: "03",
    title: "We review and quote properly",
    body: "The job appears in the owner dashboard, then M-Machine confirms the invoice before payment is arranged.",
  },
];

const fileTypes = [".DXF", ".DWG", ".AI", ".EPS", ".STEP", ".STP"];

const faqs = [
  {
    question: "Is this a SendCutSend alternative in the UK?",
    answer:
      "It is a similar upload-and-quote route for custom metal parts, handled by M-Machine's Darlington workshop. The difference is that the job is reviewed by the owner before an invoice is sent, so unusual materials, carriage and workshop notes can be handled properly.",
  },
  {
    question: "Can I upload DXF, DWG, AI, EPS, STEP or STP files?",
    answer:
      "Yes. The custom request form accepts DXF, DWG, AI, EPS, STEP and STP files. If you do not have CAD, you can still start with a sketch, photo or detailed description.",
  },
  {
    question: "Can M-Machine supply the material as well as make the part?",
    answer:
      "Yes. The request form includes the main materials from the M-Machine metals catalogue, including aluminium, brass, bronze, copper, plastics, stainless steel, steel and steel tube.",
  },
];

export default function CustomEngineeringPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Custom engineering", path: "/custom-engineering" },
  ]);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Custom metal cutting and fabrication quotes",
    provider: {
      "@type": "LocalBusiness",
      name: "M-Machine",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Unit 3-7 Forge Way, Cleveland Trading Estate",
        addressLocality: "Darlington",
        postalCode: "DL1 2PJ",
        addressCountry: "GB",
      },
      telephone: "+44 1325 381302",
    },
    areaServed: "United Kingdom",
    serviceType: [
      "Custom metal cutting",
      "CNC routing",
      "Folding and bending",
      "Threading and countersinking",
      "Metal finishing",
      "Fabricated components",
    ],
    url: absoluteUrl("/custom-engineering"),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(serviceJsonLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
              Upload a design for custom cutting, folding and fabrication
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
              A practical UK route for SendCutSend-style custom parts, with M-Machine reviewing the
              job before anything is invoiced. Upload CAD files, choose a material, explain the finish
              and we will come back with a proper quote.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#quote-form" className="btn-primary">
                Start a custom quote
              </Link>
              <Link href="#services" className="btn-secondary">
                View services
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-racing/10 bg-white p-5 shadow-sm">
            <div className="overflow-hidden rounded-xl bg-racing">
              <Image
                src="/about/mini-outside-factory.jpg"
                alt="M-Machine workshop and Classic Mini body work from the company's manufacturing history"
                width={1366}
                height={300}
                priority
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="rounded-lg bg-cream-dark p-3">
                  <div className="font-mono text-sm font-bold text-gold">{step.number}</div>
                  <div className="mt-1 text-sm font-semibold leading-5 text-racing">{step.title}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {fileTypes.map((type) => (
                <span key={type} className="rounded-md bg-cream px-3 py-2 font-mono text-xs font-semibold text-racing">
                  {type}
                </span>
              ))}
            </div>
          </aside>
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="rounded-xl border border-racing/10 bg-white p-5">
              <div className="font-mono text-sm font-bold text-gold">{step.number}</div>
              <h2 className="mt-3 font-display text-xl text-racing">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{step.body}</p>
            </article>
          ))}
        </section>

        <section id="services" className="mt-12 scroll-mt-24">
          <div className="mb-6 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              WORKSHOP SERVICES
            </p>
            <h2 className="font-display text-3xl text-racing">Custom parts without a maze of checkout steps</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              Online instant pricing is useful for simple jobs, but real workshop work often needs
              a human check. M-Machine keeps the upload process simple, then reviews the job before
              carriage, material and finishing are confirmed.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.title} className="rounded-xl border border-racing/10 bg-white p-5">
                <h3 className="font-display text-xl text-racing">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              MATERIAL OPTIONS
            </p>
            <h2 className="font-display text-3xl text-racing">Use our stock, or tell us your exact spec</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              Our metals catalogue gives customers a practical starting point for custom parts. If you
              already know the grade, thickness or finish, include it in the request. If not, describe
              what the part needs to do and we can advise before quoting.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/catalogue/metals" className="btn-secondary">
                View metals catalogue
              </Link>
              <Link href="/featured" className="btn-secondary">
                See workshop examples
              </Link>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((material) => (
              <Link
                key={material}
                href="/catalogue/metals"
                className="rounded-lg border border-racing/10 bg-white px-4 py-3 text-sm font-semibold text-racing hover:border-gold"
              >
                {material}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-racing p-7 text-cream md:p-9">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
                SENDCUTSEND-STYLE QUOTING
              </p>
              <h2 className="font-display text-3xl">A UK workshop route for upload-and-quote parts</h2>
              <p className="mt-3 text-sm leading-7 text-cream/85">
                If you have been searching for a SendCutSend-style service in the UK, this is the
                M-Machine version: upload the drawing, add the workshop notes, and let a real person
                check the job before the invoice is sent.
              </p>
            </div>
            <div className="grid gap-3">
              {faqs.map((faq) => (
                <article key={faq.question} className="rounded-xl bg-cream p-4 text-racing">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="quote-form" className="mt-12 scroll-mt-24">
          <div className="mb-6 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              START THE JOB
            </p>
            <h2 className="font-display text-3xl text-racing">Send the drawing and the details</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              This form sends the request into the owner dashboard with the uploaded files attached.
              M-Machine can then review it, add carriage or any extra work, and email the completed
              invoice back to the customer.
            </p>
          </div>
          <CustomEngineeringForm />
        </section>

        <section className="mt-12 rounded-2xl border border-racing/10 bg-white p-7 md:p-9">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
                NOT SURE WHAT TO SEND?
              </p>
              <h2 className="font-display text-3xl text-racing">A sketch, photo or clear description is enough to start.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
                Upload a drawing if you have one. If you do not, describe the part, material, rough size,
                quantity and what it needs to fit. We will come back with sensible next steps.
              </p>
            </div>
            <Link href="/contact" className="btn-secondary justify-center">
              Ask before uploading
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
