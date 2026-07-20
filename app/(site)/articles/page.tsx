import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { articleUrl, articles } from "@/lib/articles";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, openGraphImage } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Engineering Guides and Metalworking Articles",
  description:
    "Practical M-Machine guides to engineering steel grades, BS970 designations, tool-steel heat treatment and dividing-head operation.",
  alternates: { canonical: absoluteUrl("/articles") },
  openGraph: {
    title: "Engineering Guides and Metalworking Articles | M-Machine",
    description:
      "Practical workshop knowledge covering materials, machining, heat treatment and dividing-head operation.",
    url: absoluteUrl("/articles"),
    type: "website",
    images: openGraphImage(articles[0].image, articles[0].imageAlt),
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
      itemListElement: articles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        url: absoluteUrl(articleUrl(article)),
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
          Practical notes from the workshop on engineering materials, steel specifications, heat treatment and machining.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {articles.map((article, index) => (
          <article key={article.slug} className="card flex h-full flex-col bg-white">
            <Link href={articleUrl(article)} className="group block">
              <div className="relative mb-5 aspect-[16/7] overflow-hidden rounded-lg bg-cream-dark">
                <Image
                  src={article.image}
                  alt={article.imageAlt}
                  fill
                  priority={index < 2}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
                <span>{article.category}</span>
                <span aria-hidden="true">&middot;</span>
                <span className="text-ink-muted">{article.readingTime}</span>
              </div>
              <h2 className="font-display text-2xl text-racing mb-3 group-hover:text-gold">{article.title}</h2>
              <p className="text-sm leading-7 text-ink-muted">{article.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-racing group-hover:text-gold">
                Read article <span aria-hidden="true" className="ml-1">&rarr;</span>
              </span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
