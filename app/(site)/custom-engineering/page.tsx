import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import CustomEngineeringForm from "./CustomEngineeringForm";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Custom Engineering & Fabrication Quotes",
  description:
    "Upload CAD files or project details for custom cutting, folding, machining, finishing and fabricated metal parts from M-Machine in Darlington.",
  alternates: { canonical: absoluteUrl("/custom-engineering") },
  openGraph: {
    title: "Custom Engineering & Fabrication Quotes | M-Machine",
    description:
      "Request a custom fabrication quote from M-Machine. Upload DXF, DWG, AI, EPS, STEP or STP files and describe the material, finish and delivery requirements.",
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
    body: "Send flat patterns, plates, brackets, panels or blanks for cutting in the material and thickness you need.",
  },
  {
    title: "Folds, bends and formed work",
    body: "Add bend notes, critical dimensions and preferred grain direction so the workshop can quote the whole formed part.",
  },
  {
    title: "Holes, threads and inserts",
    body: "Ask for tapping, countersinking, counterboring, hardware insertion and other secondary operations in the same request.",
  },
  {
    title: "Finishing and assembly",
    body: "Request deburring, powder coating, anodising, plating, welding or assembly where the job needs more than a raw cut part.",
  },
];

const fileTypes = [".DXF", ".DWG", ".AI", ".EPS", ".STEP", ".STP"];

export default function CustomEngineeringPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Custom engineering", path: "/custom-engineering" },
  ]);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Custom engineering and fabrication quotes",
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

  return (
    <div className="bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(serviceJsonLd)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-muted">
          <Link href="/" className="hover:text-racing">Home</Link>
          <span className="mx-2">/</span>
          <span>Custom engineering</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[3px] text-gold">
              CUSTOM WORKSHOP QUOTES
            </p>
            <h1 className="font-display text-4xl leading-tight text-racing sm:text-5xl">
              Custom engineering, cutting and fabrication
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
              Send us your drawing, CAD file or rough project details and we will quote the job properly.
              We can supply the material, carry out the cutting or forming work, add finishing where needed,
              and come back to you with a reviewed invoice before payment is arranged.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {fileTypes.map((type) => (
                <span key={type} className="rounded-md bg-white px-3 py-2 font-mono text-xs font-semibold text-racing shadow-sm">
                  {type}
                </span>
              ))}
            </div>
            <div className="mt-8 overflow-hidden rounded-2xl bg-racing">
              <Image
                src="/about/mini-outside-factory.jpg"
                alt="M-Machine workshop and Classic Mini body work from the company's manufacturing history"
                width={1366}
                height={300}
                priority
                className="h-auto w-full object-cover"
              />
              <div className="p-5 text-sm leading-6 text-cream/85">
                We quote custom work from the same Darlington workshop that supports our Mini panels,
                metals catalogue and fabrication projects.
              </div>
            </div>
          </div>

          <CustomEngineeringForm />
        </header>

        <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((item) => (
            <article key={item.title} className="rounded-xl border border-racing/10 bg-white p-5">
              <h2 className="font-display text-xl text-racing">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{item.body}</p>
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
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[3px] text-gold">
                NOT SURE WHAT TO SEND?
              </p>
              <h2 className="font-display text-3xl">A sketch, photo or clear description is enough to start.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-cream/85">
                Upload a drawing if you have one. If you do not, describe the part, material, rough size,
                quantity and what it needs to fit. We will come back with sensible next steps.
              </p>
            </div>
            <Link href="/contact" className="btn-gold justify-center">
              Ask before uploading
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
