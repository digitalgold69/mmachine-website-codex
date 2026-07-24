import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  customCapabilities,
  customFaqs,
  customFileTypes,
  customMaterials,
  customWorkshopImages,
} from "@/lib/custom-engineering-content";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Custom Engineering Guide: Files, Materials & Capabilities",
  description:
    "Learn how to request custom cutting, folding, CNC machining and fabrication from M-Machine, including accepted files, materials and common questions.",
  alternates: { canonical: absoluteUrl("/custom-engineering/guide") },
  openGraph: {
    title: "Custom Engineering Guide | M-Machine",
    description:
      "Accepted files, workshop capabilities, materials and guidance for requesting a custom engineered part from M-Machine.",
    url: absoluteUrl("/custom-engineering/guide"),
    type: "article",
    images: [absoluteUrl("/custom-engineering/cnc-machining.jpg")],
  },
};

export default function CustomEngineeringGuidePage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Custom engineering", path: "/custom-engineering" },
    { name: "Custom engineering guide", path: "/custom-engineering/guide" },
  ]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: customFaqs.map((faq) => ({
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
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd)} />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:text-racing">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/custom-engineering" className="hover:text-racing">Custom engineering</Link>
          <span className="mx-2">/</span>
          <span>Guide</span>
        </nav>

        <header className="grid overflow-hidden rounded-2xl bg-racing text-cream lg:grid-cols-[0.92fr_1.08fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[3px] text-gold">
              CUSTOM ENGINEERING GUIDE
            </p>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              From your idea to a finished part
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-cream/85">
              Find out what we can make, which files to send, the materials we hold and how to
              give us enough information for an accurate quote.
            </p>
            <div className="mt-7">
              <Link href="/custom-engineering#quote-form" className="btn-gold">
                Start a custom quote
              </Link>
            </div>
          </div>
          <Image
            src="/custom-engineering/cnc-machining.jpg"
            alt="CNC machining in the M-Machine workshop"
            width={1600}
            height={1200}
            priority
            className="h-full min-h-[300px] w-full object-cover"
          />
        </header>

        <section className="mt-12">
          <div className="mb-6 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              WORKSHOP CAPABILITIES
            </p>
            <h2 className="font-display text-3xl text-racing">How we can help</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              We handle one-off parts, prototypes, replacement components and small production
              runs. Send the drawing or describe the result you need.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {customCapabilities.map((capability) => (
              <article key={capability.title} className="rounded-xl border border-racing/10 bg-white p-6">
                <h3 className="font-display text-2xl text-racing">{capability.title}</h3>
                <p className="mt-3 text-sm leading-7 text-ink-muted">{capability.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-8 rounded-2xl border border-racing/10 bg-white p-7 lg:grid-cols-[0.9fr_1.1fr] lg:p-9">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              WHAT TO SEND
            </p>
            <h2 className="font-display text-3xl text-racing">CAD is useful, but it is not essential</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              Upload the clearest information you have. A technical file is ideal, but a drawing,
              photo or written description can be enough to begin the conversation.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {customFileTypes.map((fileType) => (
                <span key={fileType} className="rounded-md bg-cream-dark px-3 py-2 font-mono text-xs font-semibold text-racing">
                  {fileType}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["CAD or drawing", "Upload the original file where possible, with dimensions and scale intact."],
              ["Sketch or photo", "Mark important measurements, holes, bends and the features that must fit."],
              ["Job details", "Explain the quantity, intended use and anything that is critical to the finished part."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-xl bg-cream p-4">
                <h3 className="font-semibold text-racing">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {customWorkshopImages.map((item) => (
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

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              MATERIALS
            </p>
            <h2 className="font-display text-3xl text-racing">A broad stock range under one roof</h2>
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              If you know the grade, include it in the job details. If not, tell us what the part
              needs to do and we can discuss suitable stock.
            </p>
            <Link href="/catalogue/metals" className="btn-secondary mt-5">
              Browse the metals catalogue
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {customMaterials.map((material) => (
              <div
                key={material}
                className="rounded-lg border border-racing/10 bg-white px-4 py-3 text-sm font-semibold text-racing"
              >
                {material}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
              COMMON QUESTIONS
            </p>
            <h2 className="font-display text-3xl text-racing">Before you send the job</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {customFaqs.map((faq) => (
              <article key={faq.question} className="rounded-xl border border-racing/10 bg-white p-5">
                <h3 className="font-semibold text-racing">{faq.question}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-muted">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-racing p-7 text-cream md:p-9">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="font-display text-3xl">Ready to request a quote?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-cream/85">
                Upload what you have, add one clear description and leave your contact details.
                Collection is the default, or you can ask us to include delivery.
              </p>
            </div>
            <Link href="/custom-engineering#quote-form" className="btn-gold justify-center">
              Start a custom quote
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
