import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { guideUrl, guides } from "@/lib/articles";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, openGraphImage } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Engineering Guides and Metalworking Articles",
  description:
    "Practical M-Machine guides to custom engineering, steel grades, BS970 designations, tool-steel heat treatment and workshop processes.",
  alternates: { canonical: absoluteUrl("/articles") },
  openGraph: {
    title: "Engineering Guides and Metalworking Articles | M-Machine",
    description:
      "Practical workshop knowledge covering custom engineering, materials, machining, heat treatment and dividing-head operation.",
    url: absoluteUrl("/articles"),
    type: "website",
    images: openGraphImage(guides[0].image, guides[0].imageAlt),
  },
};

export default function ArticlesPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Engineering Guides", path: "/articles" },
  ]);
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "M-Machine Engineering Guides",
    description: metadata.description,
    url: absoluteUrl("/articles"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: guides.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: guide.title,
        url: absoluteUrl(guideUrl(guide)),
      })),
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(collection)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <span>Engineering Guides</span>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="mb-3 text-xs font-semibold tracking-[3px] text-gold">M-MACHINE INFORMATION LIBRARY</p>
        <h1 className="font-display text-4xl text-racing mb-3">Engineering guides</h1>
        <p className="text-ink-muted leading-8">
          Practical notes from the workshop on custom engineering, materials, steel specifications, heat treatment and machining.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {guides.map((guide, index) => (
          <article key={guide.id} className="card flex h-full flex-col bg-white">
            <Link href={guideUrl(guide)} className="group block">
              <div className="relative mb-5 aspect-[16/7] overflow-hidden rounded-lg bg-cream-dark">
                <Image
                  src={guide.image}
                  alt={guide.imageAlt}
                  fill
                  priority={index < 2}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
                <span>{guide.category}</span>
                <span aria-hidden="true">&middot;</span>
                <span className="text-ink-muted">{guide.readingTime}</span>
              </div>
              <h2 className="font-display text-2xl text-racing mb-3 group-hover:text-gold">{guide.title}</h2>
              <p className="text-sm leading-7 text-ink-muted">{guide.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-racing group-hover:text-gold">
                Read guide <span aria-hidden="true" className="ml-1">&rarr;</span>
              </span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
