import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import CustomEngineeringForm from "./CustomEngineeringForm";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Upload a Design for Custom Metal Parts",
  description:
    "Upload a CAD file, sketch or photo. We cut, fold, machine, finish and send custom metal parts from our Darlington workshop.",
  alternates: { canonical: absoluteUrl("/custom-engineering") },
  openGraph: {
    title: "Upload a Design for Custom Metal Parts | M-Machine",
    description:
      "Send CAD files, sketches or photos for cutting, folding, machining and fabrication from our Darlington workshop.",
    url: absoluteUrl("/custom-engineering"),
    type: "website",
    images: [absoluteUrl("/custom-engineering/custom-fabrication-cam.jpg")],
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
    body: "Folded sheet metal, bent brackets and formed panels made from CAD files, drawings or clear dimensions.",
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
    title: "Send the design",
    body: "Upload a CAD file, drawing, photo or sketch, or describe the part you need made.",
  },
  {
    number: "02",
    title: "Choose the material",
    body: "Tell us the material, thickness, quantity, finish and any folds or machining details.",
  },
  {
    number: "03",
    title: "We make the part",
    body: "Once the quote is agreed, we cut, fold, machine or fabricate it and send it to you.",
  },
];

const fileTypes = [".DXF", ".DWG", ".AI", ".EPS", ".STEP", ".STP"];

const workshopImages = [
  {
    src: "/custom-engineering/cnc-machining.jpg",
    alt: "CNC machining work in the M-Machine workshop",
    title: "CNC machining",
    body: "Machined components, tooling, accurate holes, profiles and secondary operations.",
  },
  {
    src: "/custom-engineering/press-brake-folding.jpg",
    alt: "Press brake folding machine in the M-Machine workshop",
    title: "Folding and forming",
    body: "Brackets, folded sheet, channels, panels and formed parts made to your drawing.",
  },
  {
    src: "/custom-engineering/cut-sheet-parts.jpg",
    alt: "Flat cut metal parts ready for folding and finishing",
    title: "Cut parts",
    body: "Flat patterns, plates and blanks cut from the right stock and ready for the next step.",
  },
];

const faqs = [
  {
    question: "Is this a SendCutSend alternative in the UK?",
    answer:
      "Yes. If you are looking for a UK SendCutSend-style service, upload your file here. We quote it, make it in Darlington, and send the finished part to you.",
  },
  {
    question: "Can I upload DXF, DWG, AI, EPS, STEP or STP files?",
    answer:
      "Yes. The custom request form accepts DXF, DWG, AI, EPS, STEP and STP files. If you do not have CAD, you can still start with a sketch, photo or detailed description.",
  },
  {
    question: "Can you supply the material as well as make the part?",
    answer:
      "Yes. We stock aluminium, brass, bronze, copper, plastics, stainless steel, steel, steel tube and more. You can choose a material from the form or describe the grade you need.",
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
              Upload the design. We make the part.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
              Send a CAD file, sketch, photo or drawing. Tell us the material, quantity and finish.
              We quote it, make it in our Darlington workshop, and send the finished part to you.
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
                src="/custom-engineering/custom-fabrication-cam.jpg"
                alt="Custom machined cam part made from a technical drawing"
                width={1600}
                height={1200}
                priority
                className="aspect-[4/3] h-auto w-full object-cover"
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
              Upload the file, add the details, and we will come back with a clear quote. We can cut,
              fold, machine, finish and fabricate one-offs or small batches from our own workshop stock.
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

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {workshopImages.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-xl border border-racing/10 bg-white">
              <Image
                src={item.src}
                alt={item.alt}
                width={1600}
                height={1200}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="p-5">
                <h3 className="font-display text-xl text-racing">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{item.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              MATERIAL OPTIONS
            </p>
            <h2 className="font-display text-3xl text-racing">Use our stock, or tell us your exact spec</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              Choose from the metal and plastic stock we already hold, or tell us the grade you need.
              If you are not sure, describe what the part needs to do and we will help you choose.
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
                Looking for a SendCutSend-style service in the UK? The idea is simple: upload the file,
                get the part made. Our version is built for UK customers who want custom metalwork from
                a real workshop, with help choosing material, finish and delivery.
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
              Tell us what to make. Add files, material, finish, quantity and delivery details, then
              we will come back with a quote.
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
                quantity and what it needs to fit. We will tell you what to send next.
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
